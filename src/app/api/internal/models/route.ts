import { NextRequest, NextResponse } from 'next/server';
import { AIModelService } from '@/lib/internal/ai-models';

export async function GET(request: NextRequest) {
  try {
    const aiModelService = AIModelService.getInstance();
    const stats = await aiModelService.getModelStats();

    return NextResponse.json({
      success: true,
      models: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get model stats:', error);
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