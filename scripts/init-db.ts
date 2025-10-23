import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function initializeDatabase() {
  console.log('Initializing database schema...');
  
  try {
    // Run Prisma db push
    execSync('npx prisma db push --skip-generate --accept-destructive-changes', {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

initializeDatabase();
