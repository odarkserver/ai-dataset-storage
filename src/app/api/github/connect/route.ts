import { NextRequest, NextResponse } from 'next/server';
import GitHubConnector from '@/lib/plugins/githubConnector';

export async function POST(request: NextRequest) {
  try {
    const { token, repository } = await request.json();

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token GitHub diperlukan'
      }, { status: 400 });
    }

    const connector = GitHubConnector.getInstance();
    const result = await connector.connectWithToken(token, repository);

    return NextResponse.json(result);
  } catch (error) {
    console.error('GitHub connect error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}