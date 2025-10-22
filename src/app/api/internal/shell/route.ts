import { NextRequest, NextResponse } from 'next/server';
import { ShellAuditService } from '@/lib/internal/shell-audit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const shellService = ShellAuditService.getInstance();

    switch (action) {
      case 'pending':
        const pendingCommands = await shellService.getPendingCommands();
        return NextResponse.json({
          success: true,
          commands: pendingCommands,
          timestamp: new Date().toISOString()
        });

      case 'history':
        const limit = parseInt(searchParams.get('limit') || '100');
        const history = await shellService.getCommandHistory(limit);
        return NextResponse.json({
          success: true,
          commands: history,
          timestamp: new Date().toISOString()
        });

      case 'stats':
        const stats = await shellService.getSystemStats();
        return NextResponse.json({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        });

      case 'audit':
        const auditFilters = {
          action: searchParams.get('action') || undefined,
          status: searchParams.get('status') || undefined,
          sessionId: searchParams.get('sessionId') || undefined,
          limit: parseInt(searchParams.get('limit') || '100')
        };
        const auditLogs = await shellService.getAuditLogs(auditFilters);
        return NextResponse.json({
          success: true,
          logs: auditLogs,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Shell API error:', error);
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
    const { action, command, type, commandId, approvedBy, rejectedBy, reason, sessionId } = await request.json();
    const shellService = ShellAuditService.getInstance();

    switch (action) {
      case 'execute':
        if (!command) {
          return NextResponse.json(
            { error: 'Command is required' },
            { status: 400 }
          );
        }
        const executeResult = await shellService.executeCommand(
          command,
          type || 'system',
          'ODARK-User',
          sessionId,
          false // Require approval for safety
        );
        return NextResponse.json({
          success: true,
          result: executeResult,
          timestamp: new Date().toISOString()
        });

      case 'approve':
        if (!commandId || !approvedBy) {
          return NextResponse.json(
            { error: 'Command ID and approved by are required' },
            { status: 400 }
          );
        }
        const approveResult = await shellService.approveCommand(commandId, approvedBy, sessionId);
        return NextResponse.json({
          success: true,
          result: approveResult,
          timestamp: new Date().toISOString()
        });

      case 'reject':
        if (!commandId || !rejectedBy || !reason) {
          return NextResponse.json(
            { error: 'Command ID, rejected by, and reason are required' },
            { status: 400 }
          );
        }
        const rejectResult = await shellService.rejectCommand(commandId, rejectedBy, reason, sessionId);
        return NextResponse.json({
          success: true,
          result: rejectResult,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Shell command error:', error);
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