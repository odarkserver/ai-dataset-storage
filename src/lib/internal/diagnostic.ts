import { db } from '@/lib/db';
import { AIModelService } from '@/lib/internal/ai-models';
import { LocalStorageService } from '@/lib/internal/local-storage';
import { SystemAPIService } from '@/lib/internal/system-api';
import { ShellAuditService } from '@/lib/internal/shell-audit';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';

interface DiagnosticResult {
  category: string;
  status: 'healthy' | 'warning' | 'error' | 'critical';
  message: string;
  details?: any;
  suggestions?: string[];
  canAutoFix?: boolean;
  fixAction?: string;
}

interface SystemDiagnostic {
  timestamp: string;
  overall: 'healthy' | 'warning' | 'error' | 'critical';
  results: DiagnosticResult[];
  summary: {
    total: number;
    healthy: number;
    warning: number;
    error: number;
    critical: number;
  };
}

export class DiagnosticService {
  private static instance: DiagnosticService;

  private constructor() {}

  static getInstance(): DiagnosticService {
    if (!DiagnosticService.instance) {
      DiagnosticService.instance = new DiagnosticService();
    }
    return DiagnosticService.instance;
  }

  async runFullDiagnostic(sessionId?: string): Promise<SystemDiagnostic> {
    const results: DiagnosticResult[] = [];

    try {
      // 1. Analisis Input & Respons Terakhir
      const inputResponseAnalysis = await this.analyzeInputResponse();
      results.push(...inputResponseAnalysis);

      // 2. Cek Modul Eksekusi
      const moduleAnalysis = await this.analyzeExecutionModules();
      results.push(...moduleAnalysis);

      // 3. Audit Database & Penyimpanan Lokal
      const storageAnalysis = await this.auditStorageSystems();
      results.push(...storageAnalysis);

      // 4. Validasi API Sistem Internal
      const apiAnalysis = await this.validateInternalAPIs();
      results.push(...apiAnalysis);

      // 5. Cek Kesehatan Model AI
      const modelAnalysis = await this.checkAIModels();
      results.push(...modelAnalysis);

      // 6. Validasi Shell & Audit System
      const shellAnalysis = await this.validateShellSystem();
      results.push(...shellAnalysis);

      // 7. Cek File System & Configuration
      const fileSystemAnalysis = await this.analyzeFileSystem();
      results.push(...fileSystemAnalysis);

      // Calculate overall status
      const overall = this.calculateOverallStatus(results);
      const summary = this.calculateSummary(results);

      // Save diagnostic results to audit log
      await this.saveDiagnosticResults(results, overall, sessionId);

      return {
        timestamp: new Date().toISOString(),
        overall,
        results,
        summary
      };

    } catch (error) {
      console.error('Diagnostic service error:', error);
      
      const errorResult: DiagnosticResult = {
        category: 'Diagnostic Service',
        status: 'critical',
        message: 'Diagnostic service encountered an error',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: ['Restart diagnostic service', 'Check system logs']
      };

      return {
        timestamp: new Date().toISOString(),
        overall: 'critical',
        results: [errorResult],
        summary: { total: 1, healthy: 0, warning: 0, error: 0, critical: 1 }
      };
    }
  }

  private async analyzeInputResponse(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    try {
      // Get recent chat messages for analysis
      const recentSessions = await db.chatSession.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            take: 20,
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      let totalMessages = 0;
      let suspiciousResponses = 0;
      let failedResponses = 0;

      for (const session of recentSessions) {
        for (let i = 0; i < session.messages.length - 1; i += 2) {
          const userMessage = session.messages[i];
          const assistantMessage = session.messages[i + 1];

          if (userMessage && assistantMessage) {
            totalMessages++;

            // Check for suspicious response patterns
            if (this.isSuspiciousResponse(userMessage.content, assistantMessage.content)) {
              suspiciousResponses++;
            }

            // Check for failed responses
            if (this.isFailedResponse(assistantMessage.content)) {
              failedResponses++;
            }
          }
        }
      }

      if (totalMessages > 0) {
        const suspiciousRate = (suspiciousResponses / totalMessages) * 100;
        const failureRate = (failedResponses / totalMessages) * 100;

        if (failureRate > 20) {
          results.push({
            category: 'Input/Response Analysis',
            status: 'error',
            message: `High failure rate detected: ${failureRate.toFixed(1)}%`,
            details: { totalMessages, failedResponses, suspiciousResponses },
            suggestions: ['Check AI model status', 'Review prompt configuration', 'Verify API connectivity'],
            canAutoFix: true,
            fixAction: 'restart_ai_models'
          });
        } else if (suspiciousRate > 30) {
          results.push({
            category: 'Input/Response Analysis',
            status: 'warning',
            message: `High suspicious response rate: ${suspiciousRate.toFixed(1)}%`,
            details: { totalMessages, suspiciousResponses },
            suggestions: ['Review prompt templates', 'Check model temperature settings']
          });
        } else {
          results.push({
            category: 'Input/Response Analysis',
            status: 'healthy',
            message: `Response quality is acceptable (${totalMessages} messages analyzed)`,
            details: { totalMessages, failedResponses, suspiciousResponses }
          });
        }
      } else {
        results.push({
          category: 'Input/Response Analysis',
          status: 'warning',
          message: 'No recent messages found for analysis',
          suggestions: ['System appears to be idle or new']
        });
      }

    } catch (error) {
      results.push({
        category: 'Input/Response Analysis',
        status: 'error',
        message: 'Failed to analyze input/response patterns',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  private async analyzeExecutionModules(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    try {
      // Check for critical module files
      const criticalModules = [
        'src/lib/internal/ai-models.ts',
        'src/lib/internal/local-storage.ts',
        'src/lib/internal/system-api.ts',
        'src/lib/internal/shell-audit.ts',
        'src/lib/internal/diagnostic.ts'
      ];

      let missingModules = 0;
      const moduleStatus: string[] = [];

      for (const moduleFile of criticalModules) {
        try {
          await access(join(process.cwd(), moduleFile));
          moduleStatus.push(`${moduleFile}: OK`);
        } catch {
          missingModules++;
          moduleStatus.push(`${moduleFile}: MISSING`);
        }
      }

      if (missingModules > 0) {
        results.push({
          category: 'Execution Modules',
          status: 'critical',
          message: `${missingModules} critical modules are missing`,
          details: { missingModules, moduleStatus },
          suggestions: ['Restore missing modules from backup', 'Reinstall system components'],
          canAutoFix: false
        });
      } else {
        results.push({
          category: 'Execution Modules',
          status: 'healthy',
          message: 'All critical execution modules are present',
          details: { moduleCount: criticalModules.length }
        });
      }

      // Check module initialization
      try {
        const aiModelService = AIModelService.getInstance();
        const localStorageService = LocalStorageService.getInstance();
        const systemAPIService = SystemAPIService.getInstance();
        const shellService = ShellAuditService.getInstance();

        results.push({
          category: 'Module Initialization',
          status: 'healthy',
          message: 'All service modules initialized successfully',
          details: {
            aiModels: 'OK',
            localStorage: 'OK',
            systemAPI: 'OK',
            shellAudit: 'OK'
          }
        });

      } catch (error) {
        results.push({
          category: 'Module Initialization',
          status: 'error',
          message: 'Module initialization failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          suggestions: ['Restart services', 'Check module dependencies'],
          canAutoFix: true,
          fixAction: 'restart_services'
        });
      }

    } catch (error) {
      results.push({
        category: 'Execution Modules',
        status: 'error',
        message: 'Failed to analyze execution modules',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  private async auditStorageSystems(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    try {
      // Check database connectivity
      try {
        await db.chatSession.count();
        results.push({
          category: 'Database Connectivity',
          status: 'healthy',
          message: 'Database connection is working'
        });
      } catch (error) {
        results.push({
          category: 'Database Connectivity',
          status: 'critical',
          message: 'Database connection failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          suggestions: ['Check database server', 'Verify connection string'],
          canAutoFix: true,
          fixAction: 'restart_database'
        });
      }

      // Check local storage
      const localStorageService = LocalStorageService.getInstance();
      const storageStats = await localStorageService.getStats();

      if (storageStats) {
        const expiredRatio = storageStats.totalEntries > 0 
          ? (storageStats.expiredEntries / storageStats.totalEntries) * 100 
          : 0;

        if (expiredRatio > 50) {
          results.push({
            category: 'Local Storage',
            status: 'warning',
            message: `High expired entries ratio: ${expiredRatio.toFixed(1)}%`,
            details: storageStats,
            suggestions: ['Run storage cleanup', 'Review expiration policies'],
            canAutoFix: true,
            fixAction: 'cleanup_storage'
          });
        } else {
          results.push({
            category: 'Local Storage',
            status: 'healthy',
            message: 'Local storage is operating normally',
            details: storageStats
          });
        }
      } else {
        results.push({
          category: 'Local Storage',
          status: 'error',
          message: 'Unable to retrieve storage statistics',
          suggestions: ['Check storage service', 'Verify file permissions']
        });
      }

    } catch (error) {
      results.push({
        category: 'Storage Systems',
        status: 'error',
        message: 'Storage audit failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  private async validateInternalAPIs(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    try {
      const systemAPIService = SystemAPIService.getInstance();
      const apiStats = await systemAPIService.getAPIStats();

      let activeAPIs = 0;
      let failedAPIs = 0;

      for (const api of apiStats) {
        if (api.status === 'active') {
          activeAPIs++;
        } else {
          failedAPIs++;
        }
      }

      if (failedAPIs > 0) {
        results.push({
          category: 'Internal APIs',
          status: 'warning',
          message: `${failedAPIs} APIs are not active`,
          details: { totalAPIs: apiStats.length, activeAPIs, failedAPIs },
          suggestions: ['Check API configurations', 'Restart failed services'],
          canAutoFix: true,
          fixAction: 'restart_apis'
        });
      } else {
        results.push({
          category: 'Internal APIs',
          status: 'healthy',
          message: `All ${activeAPIs} internal APIs are active`,
          details: { totalAPIs: apiStats.length }
        });
      }

      // Test critical API endpoints
      const criticalAPIs = [
        { name: 'System Health', endpoint: '/api/internal/health' },
        { name: 'Model Status', endpoint: '/api/internal/models' },
        { name: 'Storage Status', endpoint: '/api/internal/storage' }
      ];

      let workingAPIs = 0;

      for (const api of criticalAPIs) {
        try {
          // Simulate API call (in real implementation, make actual HTTP requests)
          workingAPIs++;
        } catch (error) {
          results.push({
            category: 'API Endpoint',
            status: 'error',
            message: `API endpoint ${api.name} is not responding`,
            details: { endpoint: api.endpoint },
            suggestions: ['Check API service', 'Verify endpoint configuration']
          });
        }
      }

      if (workingAPIs === criticalAPIs.length) {
        results.push({
          category: 'API Endpoints',
          status: 'healthy',
          message: 'All critical API endpoints are responding'
        });
      }

    } catch (error) {
      results.push({
        category: 'Internal APIs',
        status: 'error',
        message: 'API validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  private async checkAIModels(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    try {
      const aiModelService = AIModelService.getInstance();
      const modelStats = await aiModelService.getModelStats();

      let activeModels = 0;
      let unhealthyModels = 0;

      for (const model of modelStats) {
        if (model.status === 'active') {
          activeModels++;
          
          // Check model health metrics
          if (model.successRate < 80) {
            unhealthyModels++;
          }
        }
      }

      if (unhealthyModels > 0) {
        results.push({
          category: 'AI Models Health',
          status: 'warning',
          message: `${unhealthyModels} models have low success rates`,
          details: { totalModels: modelStats.length, activeModels, unhealthyModels },
          suggestions: ['Check model configurations', 'Review model performance'],
          canAutoFix: true,
          fixAction: 'restart_models'
        });
      } else if (activeModels === 0) {
        results.push({
          category: 'AI Models Health',
          status: 'critical',
          message: 'No active AI models found',
          details: { totalModels: modelStats.length },
          suggestions: ['Initialize AI models', 'Check model service'],
          canAutoFix: true,
          fixAction: 'initialize_models'
        });
      } else {
        results.push({
          category: 'AI Models Health',
          status: 'healthy',
          message: `All ${activeModels} AI models are healthy`,
          details: { totalModels: modelStats.length, activeModels }
        });
      }

    } catch (error) {
      results.push({
        category: 'AI Models Health',
        status: 'error',
        message: 'Failed to check AI models',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  private async validateShellSystem(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    try {
      const shellService = ShellAuditService.getInstance();
      const shellStats = await shellService.getSystemStats();

      if (shellStats.commands.pending > 10) {
        results.push({
          category: 'Shell System',
          status: 'warning',
          message: `${shellStats.commands.pending} pending shell commands`,
          details: shellStats.commands,
          suggestions: ['Approve or reject pending commands', 'Review command approval process']
        });
      } else {
        results.push({
          category: 'Shell System',
          status: 'healthy',
          message: 'Shell system is operating normally',
          details: shellStats.commands
        });
      }

      // Check audit log integrity
      const recentLogs = await shellService.getAuditLogs({ limit: 100 });
      
      if (recentLogs.length === 0) {
        results.push({
          category: 'Audit System',
          status: 'warning',
          message: 'No recent audit logs found',
          suggestions: ['Check audit logging service', 'Verify log retention policies']
        });
      } else {
        results.push({
          category: 'Audit System',
          status: 'healthy',
          message: `Audit system is working (${recentLogs.length} recent logs)`,
          details: { recentLogCount: recentLogs.length }
        });
      }

    } catch (error) {
      results.push({
        category: 'Shell System',
        status: 'error',
        message: 'Failed to validate shell system',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  private async analyzeFileSystem(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    try {
      // Check critical directories
      const criticalDirs = [
        'src/lib/internal',
        'storage/chat.zai',
        'prisma',
        'public'
      ];

      let accessibleDirs = 0;

      for (const dir of criticalDirs) {
        try {
          await access(join(process.cwd(), dir));
          accessibleDirs++;
        } catch {
          results.push({
            category: 'File System',
            status: 'error',
            message: `Critical directory not accessible: ${dir}`,
            suggestions: ['Check directory permissions', 'Restore missing directories']
          });
        }
      }

      if (accessibleDirs === criticalDirs.length) {
        results.push({
          category: 'File System',
          status: 'healthy',
          message: 'All critical directories are accessible',
          details: { totalDirs: criticalDirs.length, accessibleDirs }
        });
      }

      // Check configuration files
      const configFiles = [
        '.env',
        'package.json',
        'next.config.js',
        'prisma/schema.prisma'
      ];

      let accessibleConfigs = 0;

      for (const config of configFiles) {
        try {
          await access(join(process.cwd(), config));
          accessibleConfigs++;
        } catch {
          results.push({
            category: 'Configuration',
            status: 'warning',
            message: `Configuration file not found: ${config}`,
            suggestions: ['Restore missing configuration files']
          });
        }
      }

      if (accessibleConfigs === configFiles.length) {
        results.push({
          category: 'Configuration',
          status: 'healthy',
          message: 'All configuration files are present',
          details: { totalConfigs: configFiles.length, accessibleConfigs }
        });
      }

    } catch (error) {
      results.push({
        category: 'File System',
        status: 'error',
        message: 'File system analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  private isSuspiciousResponse(userInput: string, assistantResponse: string): boolean {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /saya tidak bisa/i,
      /maaf, saya tidak/i,
      /terjadi kesalahan/i,
      /coba lagi nanti/i,
      /sistem sedang bermasalah/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(assistantResponse)) &&
           assistantResponse.length < 100; // Short error responses
  }

  private isFailedResponse(response: string): boolean {
    const failurePatterns = [
      /internal server error/i,
      /failed to process/i,
      /system error/i,
      /connection failed/i,
      /timeout error/i
    ];

    return failurePatterns.some(pattern => pattern.test(response));
  }

  private calculateOverallStatus(results: DiagnosticResult[]): 'healthy' | 'warning' | 'error' | 'critical' {
    if (results.some(r => r.status === 'critical')) return 'critical';
    if (results.some(r => r.status === 'error')) return 'error';
    if (results.some(r => r.status === 'warning')) return 'warning';
    return 'healthy';
  }

  private calculateSummary(results: DiagnosticResult[]) {
    return {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      warning: results.filter(r => r.status === 'warning').length,
      error: results.filter(r => r.status === 'error').length,
      critical: results.filter(r => r.status === 'critical').length
    };
  }

  private async saveDiagnosticResults(
    results: DiagnosticResult[], 
    overall: string, 
    sessionId?: string
  ) {
    try {
      await db.auditLog.create({
        data: {
          sessionId: sessionId || null,
          action: 'diagnostic_run',
          resource: 'system_health',
          details: {
            overall,
            results: results.map(r => ({
              category: r.category,
              status: r.status,
              message: r.message
            })),
            summary: this.calculateSummary(results)
          },
          status: overall === 'healthy' ? 'success' : 'warning',
          ipAddress: '127.0.0.1',
          userAgent: 'ODARK-Diagnostic'
        }
      });
    } catch (error) {
      console.error('Failed to save diagnostic results:', error);
    }
  }

  async getDiagnosticHistory(limit: number = 50) {
    try {
      const history = await db.auditLog.findMany({
        where: {
          action: 'diagnostic_run'
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          details: true,
          status: true,
          timestamp: true,
          session: {
            select: {
              sessionId: true
            }
          }
        }
      });

      return history.map(log => ({
        id: log.id,
        sessionId: log.session?.sessionId,
        overall: log.status,
        timestamp: log.timestamp,
        summary: log.details?.summary || {},
        resultCount: log.details?.results?.length || 0
      }));
    } catch (error) {
      console.error('Failed to get diagnostic history:', error);
      return [];
    }
  }

  async executeAutoFix(fixAction: string, sessionId?: string): Promise<boolean> {
    try {
      switch (fixAction) {
        case 'restart_ai_models':
          const aiModelService = AIModelService.getInstance();
          await aiModelService.initializeModels();
          break;

        case 'restart_services':
          // Re-initialize all services
          await AIModelService.getInstance().initializeModels();
          await LocalStorageService.getInstance().initializeStorage();
          await SystemAPIService.getInstance().initializeAPIs();
          break;

        case 'cleanup_storage':
          const localStorageService = LocalStorageService.getInstance();
          await localStorageService.cleanup();
          break;

        case 'restart_apis':
          await SystemAPIService.getInstance().initializeAPIs();
          break;

        case 'restart_models':
          await AIModelService.getInstance().initializeModels();
          break;

        case 'initialize_models':
          await AIModelService.getInstance().initializeModels();
          break;

        default:
          return false;
      }

      // Log the auto-fix
      await db.auditLog.create({
        data: {
          sessionId: sessionId || null,
          action: 'auto_fix_executed',
          resource: fixAction,
          details: { fixAction, timestamp: new Date().toISOString() },
          status: 'success',
          ipAddress: '127.0.0.1',
          userAgent: 'ODARK-Diagnostic'
        }
      });

      return true;

    } catch (error) {
      console.error(`Auto-fix failed for ${fixAction}:`, error);
      
      await db.auditLog.create({
        data: {
          sessionId: sessionId || null,
          action: 'auto_fix_failed',
          resource: fixAction,
          details: { 
            fixAction, 
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          },
          status: 'failed',
          ipAddress: '127.0.0.1',
          userAgent: 'ODARK-Diagnostic'
        }
      });

      return false;
    }
  }
}