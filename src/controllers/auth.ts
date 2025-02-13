import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user';
import { registerSchema, loginSchema } from '../zod/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate the incoming data using Zod
    const parsedData = registerSchema.safeParse(req.body);
    if (!parsedData.success) {
      // Return all error messages from Zod validation
      const errorMessage = parsedData.error.errors
        .map((err) => err.message)
        .join(', ');
      res.status(400).json({ message: errorMessage });
      return;
    }

    const { username, email, password } = parsedData.data;

    // Check if a user with the provided email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: 'User already exists' });
      return;
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const user: IUser = new User({ username, email, password: hashedPassword });
    await user.save();

    // Create a JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return the new user info (including password hash) and the token
    res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate the incoming data using Zod
    const parsedData = loginSchema.safeParse(req.body);
    if (!parsedData.success) {
      const errorMessage = parsedData.error.errors
        .map((err) => err.message)
        .join(', ');
      res.status(400).json({ message: errorMessage });
      return;
    }

    const { email, password } = parsedData.data;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Create a JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return user info and token
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
