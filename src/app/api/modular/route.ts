import { NextRequest, NextResponse } from 'next/server';
import { PluginExecutor } from '@/lib/plugins/pluginExecutor';

export async function POST(request: NextRequest) {
  try {
    const { pluginName, pluginParams } = await request.json();

    if (!pluginName) {
      return NextResponse.json({
        success: false,
        error: 'Plugin name is required'
      }, { status: 400 });
    }

    const executor = PluginExecutor.getInstance();
    const result = await executor.executePlugin(pluginName, pluginParams);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Modular API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const executor = PluginExecutor.getInstance();
    const plugins = executor.getAllPluginsInfo();
    const stats = executor.getPluginStats();

    return NextResponse.json({
      success: true,
      plugins,
      stats,
      availablePlugins: executor.getAvailablePlugins()
    });
  } catch (error) {
    console.error('Modular API GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}