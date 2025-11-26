import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';

export const seedDatabase = () => {
  try {
    // Check if admin already exists
    const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@fhd.agency');

    if (!adminExists) {
      console.log('Creating initial admin user...');

      const hashedPassword = bcrypt.hashSync('Admin@123', 10);

      db.prepare(`
        INSERT INTO users (id, email, password, name, role, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        uuidv4(),
        'admin@fhd.agency',
        hashedPassword,
        'Administrator',
        'admin',
        1
      );

      console.log('Initial admin user created!');
      console.log('  Email: admin@fhd.agency');
      console.log('  Password: Admin@123');
      console.log('  Please change this password after first login!');
    } else {
      console.log('Admin user already exists. Skipping seed.');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};
