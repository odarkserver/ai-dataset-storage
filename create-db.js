const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  console.log('✅ SQLite database file created at:', dbPath);
  
  // Create basic schema
  db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
    
    // Create a test table to ensure the database is properly initialized
    db.run(`
      CREATE TABLE IF NOT EXISTS "User" (
        id TEXT NOT NULL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating User table:', err);
      } else {
        console.log('✅ User table created');
      }
    });
    
    db.run(`
      CREATE TABLE IF NOT EXISTS "ChatSession" (
        id TEXT NOT NULL PRIMARY KEY,
        sessionId TEXT NOT NULL UNIQUE,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating ChatSession table:', err);
      } else {
        console.log('✅ ChatSession table created');
      }
    });
    
    db.run(`
      CREATE TABLE IF NOT EXISTS "ChatMessage" (
        id TEXT NOT NULL PRIMARY KEY,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sessionId) REFERENCES "ChatSession"(sessionId) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating ChatMessage table:', err);
      } else {
        console.log('✅ ChatMessage table created');
      }
    });
    
    db.run(`
      CREATE TABLE IF NOT EXISTS "LocalStorage" (
        id TEXT NOT NULL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value JSON NOT NULL,
        type TEXT NOT NULL,
        expiresAt DATETIME,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating LocalStorage table:', err);
      } else {
        console.log('✅ LocalStorage table created');
      }
    });
    
    db.run(`
      CREATE TABLE IF NOT EXISTS "AIModel" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        version TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        config JSON,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating AIModel table:', err);
      } else {
        console.log('✅ AIModel table created');
      }
    });
    
    db.run(`
      CREATE TABLE IF NOT EXISTS "ModelUsage" (
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
      )
    `, (err) => {
      if (err) {
        console.error('Error creating ModelUsage table:', err);
      } else {
        console.log('✅ ModelUsage table created');
      }
    });
    
    db.run(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
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
      )
    `, (err) => {
      if (err) {
        console.error('Error creating AuditLog table:', err);
      } else {
        console.log('✅ AuditLog table created');
      }
    });
  });
  
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
      process.exit(1);
    }
    console.log('✅ Database initialization complete');
    process.exit(0);
  });
});
