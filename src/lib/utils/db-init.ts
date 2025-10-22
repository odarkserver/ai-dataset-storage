import { PrismaClient } from '@prisma/client';

let initPromise: Promise<void> | null = null;

export async function initializeDatabase() {
  // Use a singleton pattern to ensure initialization only happens once
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const prisma = new PrismaClient();
      
      // Test the database connection by running a simple query
      await prisma.$executeRaw`SELECT 1`;
      
      console.log('✅ Database connection verified');
      
      // Attempt to create tables if they don't exist
      await createTablesIfNotExists(prisma);
      
      await prisma.$disconnect();
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      // Continue anyway - the error handling will be done at the API level
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
