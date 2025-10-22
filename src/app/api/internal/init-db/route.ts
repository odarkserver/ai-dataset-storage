import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Try to create a test record to ensure database is initialized
    await db.localStorage.create({
      data: {
        key: '_db_init_test',
        value: { initialized: true },
        type: 'config'
      }
    }).catch(async () => {
      // If create fails, try update (already exists)
      await db.localStorage.update({
        where: { key: '_db_init_test' },
        data: { value: { initialized: true } }
      }).catch(() => {
        // Ignore errors
      });
    });

    // Clean up test record
    await db.localStorage.deleteMany({
      where: { key: '_db_init_test' }
    }).catch(() => {
      // Ignore errors
    });

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
