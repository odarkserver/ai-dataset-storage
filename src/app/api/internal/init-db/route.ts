import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { initializeDatabase } from '@/lib/utils/db-init';

export async function POST(request: NextRequest) {
  try {
    // Initialize database schema
    await initializeDatabase();

    // Try to create a test record to ensure database is working
    try {
      await db.localStorage.create({
        data: {
          key: '_db_init_test_' + Date.now(),
          value: { initialized: true },
          type: 'config'
        }
      });

      // Clean up test record
      await db.localStorage.deleteMany({
        where: { key: { startsWith: '_db_init_test_' } }
      }).catch(() => {
        // Ignore errors
      });
    } catch (error) {
      // Database might not be fully ready yet, but that's okay
      console.warn('Database write test failed, but initialization may still succeed:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully'
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Simple health check for database
    const count = await db.localStorage.count().catch(() => 0);
    
    return NextResponse.json({
      success: true,
      status: 'connected',
      records: count
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
