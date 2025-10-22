import { NextRequest, NextResponse } from 'next/server';
import { AgentExecutor } from '@/lib/core/agentExecutor';
import { AuditLogger } from '@/lib/audit/auditLogger';
import { LocalStorageService } from '@/lib/internal/local-storage';

export async function POST(request: NextRequest) {
  try {
    const { message, conversation, sessionId, userId = 'Guest', executeActions = false, approvedActions = [] } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // Initialize services
    const agentExecutor = AgentExecutor.getInstance();
    const auditLogger = AuditLogger.getInstance();
    const localStorageService = LocalStorageService.getInstance();

    // Get user context (with fallback for database errors)
    let userPreferences = null;
    let currentPersona = null;
    let systemStatus = null;

    try {
      userPreferences = await localStorageService.get(`user_prefs_${userId}`);
      currentPersona = await localStorageService.get('current_persona');
      systemStatus = await localStorageService.get('system_status');
    } catch (dbError) {
      console.warn('Database access failed, continuing without preferences:', dbError);
    }

    // Build execution request
    const executionRequest = {
      input: message,
      user: userId,
      sessionId,
      context: {
        sessionId,
        userId,
        previousMessages: conversation || [],
        currentPersona,
        userPreferences,
        systemStatus
      }
    };

    // Create execution preview
    let previews = [];
    let requiresApproval = false;

    try {
      const previewResult = await agentExecutor.createPreview(executionRequest);
      previews = previewResult.previews;
      requiresApproval = previewResult.requiresApproval;
    } catch (previewError) {
      console.warn('Failed to create preview:', previewError);
    }

    // If actions require approval and not approved, return preview
    if (requiresApproval && !executeActions) {
      // Log preview request (with error handling)
      try {
        await auditLogger.logAction(userId, 'preview_requested', {
          message,
          previews,
          requiresApproval,
          sessionId
        }, {
          category: 'chat',
          level: 'info',
          metadata: { previewCount: previews.length }
        });
      } catch (auditError) {
        console.warn('Failed to log action:', auditError);
      }

      return NextResponse.json({
        response: 'Saya mendeteksi beberapa tindakan yang perlu persetujuan. Berikut preview yang akan saya eksekusi:',
        previews,
        requiresApproval,
        needsApproval: true,
        timestamp: new Date().toISOString()
      });
    }

    // If actions are approved, execute them
    if (executeActions && approvedActions.length > 0) {
      try {
        const results = await agentExecutor.execute(executionRequest, approvedActions);

        // Format execution results
        const successfulActions = results.filter(r => r.success);
        const failedActions = results.filter(r => !r.success);

        let responseMessage = 'Eksekusi selesai. ';

        if (successfulActions.length > 0) {
          responseMessage += `Berhasil menjalankan ${successfulActions.length} tindakan: `;
          responseMessage += successfulActions.map(r => r.action).join(', ');
        }

        if (failedActions.length > 0) {
          responseMessage += ` Gagal menjalankan ${failedActions.length} tindakan.`;
        }

        return NextResponse.json({
          response: responseMessage,
          executionResults: results,
          executedActions: approvedActions,
          success: failedActions.length === 0,
          timestamp: new Date().toISOString()
        });
      } catch (execError) {
        console.error('Execution error:', execError);
        return NextResponse.json({
          response: 'Maaf, terjadi kesalahan saat menjalankan tindakan. Silakan coba lagi.',
          success: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Process as regular chat
    let chatResponse = 'Saya memahami pesan Anda, tetapi sedang mengalami kesulitan dalam memproses respons.';

    try {
      chatResponse = await agentExecutor.processChat(executionRequest);
    } catch (chatError) {
      console.warn('Chat processing error:', chatError);
      // Continue with fallback response
    }

    return NextResponse.json({
      response: chatResponse,
      previews: previews.length > 0 ? previews : undefined,
      hasAvailableActions: previews.length > 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API Error:', error);

    // Log error (with error handling)
    try {
      const auditLogger = AuditLogger.getInstance();
      await auditLogger.logAction('system', 'chat_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        category: 'system',
        level: 'error'
      });
    } catch (auditError) {
      console.warn('Failed to log error:', auditError);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        response: 'Sistem mengalami gangguan sementara. Silakan coba lagi dalam beberapa saat.'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const agentExecutor = AgentExecutor.getInstance();
    const auditLogger = AuditLogger.getInstance();
    
    // Get system status
    const systemHealth = await auditLogger.getSystemHealth();
    const availableActions = agentExecutor.getAvailableActions();
    const auditStats = await auditLogger.getAuditStats(1); // Last 24 hours

    return NextResponse.json({
      status: 'ODARK Modular Chat API Online',
      version: '3.0.0',
      architecture: 'modular',
      features: {
        agentExecutor: true,
        permissionGate: true,
        pluginSystem: true,
        commitAPI: true,
        zhupiAdapter: true,
        promptBuilder: true,
        auditLogger: true
      },
      availableActions,
      systemHealth,
      auditStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'ODARK Modular Chat API Online',
      version: '3.0.0',
      architecture: 'modular',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
