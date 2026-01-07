import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { generateToken, hashPassword, comparePassword } from '../utils/auth';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, phone, pin, role, first_name, last_name, business_name, shop_name, company_name } = req.body;

    // Determine role from URL if not provided
    let targetRole = role;
    if (!targetRole) {
      if (req.baseUrl.includes('store')) targetRole = 'consumer';
      else if (req.baseUrl.includes('retailer')) targetRole = 'retailer';
      else if (req.baseUrl.includes('wholesaler')) targetRole = 'wholesaler';
    }

    // Check existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { phone: phone || undefined }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = password ? await hashPassword(password) : undefined;
    const hashedPin = pin ? await hashPassword(pin) : undefined;

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        pin: hashedPin, // Store pin (hashed)
        role: targetRole,
        name: first_name ? `${first_name} ${last_name || ''}`.trim() : (business_name || company_name || shop_name),
      }
    });

    // Create Profile
    if (targetRole === 'consumer') {
      await prisma.consumerProfile.create({
        data: {
          userId: user.id
        }
      });
    } else if (targetRole === 'retailer') {
      await prisma.retailerProfile.create({
        data: {
          userId: user.id,
          shopName: shop_name || business_name || 'My Shop',
          address: req.body.address
        }
      });
    } else if (targetRole === 'wholesaler') {
      await prisma.wholesalerProfile.create({
        data: {
          userId: user.id,
          companyName: company_name || 'My Company',
          address: req.body.address
        }
      });
    }

    const token = generateToken({ id: user.id, role: user.role });

    res.json({
      success: true,
      access_token: token,
      user_id: user.id,
      message: 'Registration successful'
    });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, phone, pin } = req.body;

    let targetRole = req.body.role;
    if (!targetRole) {
      if (req.baseUrl.includes('store')) targetRole = 'consumer';
      else if (req.baseUrl.includes('retailer')) targetRole = 'retailer';
      else if (req.baseUrl.includes('wholesaler')) targetRole = 'wholesaler';
      else if (req.baseUrl.includes('employee')) targetRole = 'employee';
      else if (req.baseUrl.includes('admin')) targetRole = 'admin';
    }

    // Find User
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { phone: phone || undefined }
        ],
        role: targetRole // Ensure role matches
      },
      include: {
        consumerProfile: true,
        retailerProfile: true,
        wholesalerProfile: true,
        employeeProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or role' });
    }

    // Verify Password or PIN
    let valid = false;
    if (targetRole === 'consumer') {
      if (user.pin && pin && await comparePassword(pin, user.pin)) valid = true;
      else if (user.password && password && await comparePassword(password, user.password)) valid = true;
    } else {
      if (user.password && await comparePassword(password, user.password)) valid = true;
    }

    if (!valid) {
      // Fallback for "demo" usage - if strict auth fails, check for mocked credentials?
      // No, I'm building a real backend. Validation must pass.
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, role: user.role });

    // Format Response
    const responseData: any = {
      success: true,
      access_token: token,
    };

    if (targetRole === 'consumer') {
      responseData.customer = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        first_name: user.name?.split(' ')[0],
        last_name: user.name?.split(' ').slice(1).join(' '),
        ...user.consumerProfile
      };
    } else if (targetRole === 'retailer') {
      responseData.retailer = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        shop_name: user.retailerProfile?.shopName,
        name: user.name,
        ...user.retailerProfile
      };
    } else if (targetRole === 'wholesaler') {
      responseData.wholesaler = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        company_name: user.wholesalerProfile?.companyName,
        name: user.name,
        ...user.wholesalerProfile
      };
    } else if (targetRole === 'employee') {
      responseData.employee = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        ...user.employeeProfile
      };
    } else if (targetRole === 'admin') {
      responseData.admin = {
        id: user.id,
        email: user.email,
        name: user.name
      };
    }

    res.json(responseData);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const updatePassword = async (req: any, res: Response) => {
  try {
    const { old_password, new_password } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await comparePassword(old_password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const hashedPassword = await hashPassword(new_password);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePin = async (req: any, res: Response) => {
  try {
    const { old_pin, new_pin } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.pin) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await comparePassword(old_pin, user.pin);
    if (!isValid) {
      return res.status(400).json({ error: 'Incorrect current PIN' });
    }

    const hashedPin = await hashPassword(new_pin);
    await prisma.user.update({
      where: { id: userId },
      data: { pin: hashedPin }
    });

    res.json({ success: true, message: 'PIN updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
