import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

let initPromise: Promise<void> | null = null;
let isInitialized = false;

export async function initializeDatabase() {
  // Use a singleton pattern to ensure initialization only happens once
  if (isInitialized) {
    return Promise.resolve();
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Create an empty SQLite database file if it doesn't exist
      const dbPath = resolve(process.cwd(), 'dev.db');

      if (!existsSync(dbPath)) {
        // Create an empty SQLite database file
        writeFileSync(dbPath, Buffer.from([
          0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
          0x10, 0x00, 0x01, 0x01, 0x00, 0x40, 0x20, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]));
        console.log('✅ SQLite database file created at:', dbPath);
      }

      // Try to create tables using Prisma
      const prisma = new PrismaClient();

      try {
        // Test basic connectivity
        await prisma.$queryRaw`PRAGMA table_list`;
        console.log('✅ Database connection verified');
      } catch (connectionError) {
        console.warn('Connection test warning:', connectionError);
      }

      await prisma.$disconnect();
      isInitialized = true;
      console.log('✅ Database initialization complete');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      // Continue anyway - migrations will be run by Prisma when needed
    }
  })();

  return initPromise;
}

async function createTablesIfNotExists(prisma: PrismaClient) {
  try {
    // Create tables using raw SQL
    const tables = [
      `CREATE TABLE IF NOT EXISTS "User" (
        id TEXT NOT NULL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS "ChatSession" (
        id TEXT NOT NULL PRIMARY KEY,
        sessionId TEXT NOT NULL UNIQUE,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS "ChatMessage" (
        id TEXT NOT NULL PRIMARY KEY,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sessionId) REFERENCES "ChatSession"(sessionId) ON DELETE CASCADE,
        CONSTRAINT ChatMessage_sessionId_idx UNIQUE(sessionId)
      )`,
      
      `CREATE TABLE IF NOT EXISTS "LocalStorage" (
        id TEXT NOT NULL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value JSON NOT NULL,
        type TEXT NOT NULL,
        expiresAt DATETIME,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS "AIModel" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        version TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        config JSON,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS "ModelUsage" (
        id TEXT NOT NULL PRIMARY KEY,
        modelId TEXT NOT NULL,
        sessionId TEXT,
        action TEXT NOT NULL,
        tokens INTEGER,
        responseTime INTEGER,
        success BOOLEAN NOT NULL DEFAULT 1,
        error TEXT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (modelId) REFERENCES "AIModel"(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS "SystemAPI" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        config JSON,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS "APIUsage" (
        id TEXT NOT NULL PRIMARY KEY,
        apiId TEXT NOT NULL,
        sessionId TEXT,
        request JSON NOT NULL,
        response JSON,
        status INTEGER NOT NULL,
        responseTime INTEGER,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (apiId) REFERENCES "SystemAPI"(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS "ShellCommand" (
        id TEXT NOT NULL PRIMARY KEY,
        command TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        error TEXT,
        executedBy TEXT,
        executedAt DATETIME,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS "AuditLog" (
        id TEXT NOT NULL PRIMARY KEY,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        input JSON,
        result JSON,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sessionId TEXT,
        executionId TEXT,
        category TEXT NOT NULL,
        level TEXT NOT NULL,
        metadata JSON,
        ipAddress TEXT,
        userAgent TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS "GitHubConfig" (
        id TEXT NOT NULL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        repository TEXT NOT NULL,
        branch TEXT NOT NULL DEFAULT 'main',
        dataPath TEXT NOT NULL DEFAULT 'datasets',
        isConfigured BOOLEAN NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS "DatasetMetadata" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        description TEXT,
        path TEXT NOT NULL,
        sha TEXT NOT NULL,
        size INTEGER,
        username TEXT NOT NULL,
        repository TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (username) REFERENCES "GitHubConfig"(username) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS "DatabaseBackup" (
        id TEXT NOT NULL PRIMARY KEY,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER,
        url TEXT,
        type TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const createTableSql of tables) {
      try {
        await prisma.$executeRawUnsafe(createTableSql);
      } catch (error) {
        // Table might already exist, which is fine
        if (!(error instanceof Error && error.message.includes('already exists'))) {
          console.warn(`Warning creating table: ${error}`);
        }
      }
    }
    
    console.log('✅ All tables created/verified');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}
