import { NextResponse } from 'next/server';
import GitHubConnector from '@/lib/plugins/githubConnector';

export async function POST() {
  try {
    const connector = GitHubConnector.getInstance();
    const result = await connector.disconnect();

    return NextResponse.json(result);
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}