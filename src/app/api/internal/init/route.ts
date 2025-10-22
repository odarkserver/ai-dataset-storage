import { NextRequest, NextResponse } from 'next/server';
import { AIModelService } from '@/lib/internal/ai-models';
import { LocalStorageService } from '@/lib/internal/local-storage';
import { SystemAPIService } from '@/lib/internal/system-api';

export async function POST(request: NextRequest) {
  try {
    const aiModelService = AIModelService.getInstance();
    const localStorageService = LocalStorageService.getInstance();
    const systemAPIService = SystemAPIService.getInstance();

    // Initialize all internal services
    await Promise.all([
      aiModelService.initializeModels(),
      localStorageService.initializeStorage(),
      systemAPIService.initializeAPIs()
    ]);

    return NextResponse.json({
      success: true,
      message: 'ODARK Internal Systems initialized successfully',
      services: {
        aiModels: 'initialized',
        localStorage: 'initialized',
        systemAPIs: 'initialized'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to initialize internal systems:', error);
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

export async function GET() {
  try {
    const localStorageService = LocalStorageService.getInstance();
    const stats = await localStorageService.getStats();

    return NextResponse.json({
      status: 'ODARK Internal Systems',
      initialized: true,
      storage: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'ODARK Internal Systems',
        initialized: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}