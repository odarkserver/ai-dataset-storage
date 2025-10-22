import { NextResponse } from 'next/server';
import GitHubConnector from '@/lib/plugins/githubConnector';

export async function GET() {
  try {
    const connector = GitHubConnector.getInstance();
    await connector.loadConfig();
    const result = await connector.listRepositories();

    return NextResponse.json(result);
  } catch (error) {
    console.error('GitHub repositories error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}