import { NextRequest, NextResponse } from 'next/server';
import { LocalStorageService } from '@/lib/internal/local-storage';

export async function GET(request: NextRequest) {
  try {
    const localStorageService = LocalStorageService.getInstance();
    const stats = await localStorageService.getStats();

    return NextResponse.json({
      success: true,
      storage: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, key, value, type } = await request.json();
    const localStorageService = LocalStorageService.getInstance();

    switch (action) {
      case 'cleanup':
        const cleanedCount = await localStorageService.cleanup();
        return NextResponse.json({
          success: true,
          cleanedCount,
          message: `Cleaned up ${cleanedCount} expired entries`,
          timestamp: new Date().toISOString()
        });

      case 'backup':
        const backupPath = await localStorageService.backup();
        return NextResponse.json({
          success: true,
          backupPath,
          message: 'Backup created successfully',
          timestamp: new Date().toISOString()
        });

      case 'set':
        if (!key || value === undefined) {
          return NextResponse.json(
            { error: 'Key and value are required' },
            { status: 400 }
          );
        }
        await localStorageService.set(key, value, type || 'cache');
        return NextResponse.json({
          success: true,
          message: 'Value stored successfully',
          timestamp: new Date().toISOString()
        });

      case 'get':
        if (!key) {
          return NextResponse.json(
            { error: 'Key is required' },
            { status: 400 }
          );
        }
        const storedValue = await localStorageService.get(key);
        return NextResponse.json({
          success: true,
          value: storedValue,
          timestamp: new Date().toISOString()
        });

      case 'delete':
        if (!key) {
          return NextResponse.json(
            { error: 'Key is required' },
            { status: 400 }
          );
        }
        await localStorageService.delete(key);
        return NextResponse.json({
          success: true,
          message: 'Key deleted successfully',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Storage operation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}