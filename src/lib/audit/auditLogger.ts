import { db } from '@/lib/db';

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  input: any;
  result: any;
  timestamp: Date;
  sessionId?: string;
  executionId?: string;
  category: 'chat' | 'plugin' | 'commit_api' | 'zhupi_api' | 'security' | 'system';
  level: 'info' | 'warning' | 'error' | 'critical';
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditFilter {
  actor?: string;
  action?: string;
  category?: string;
  level?: string;
  startDate?: Date;
  endDate?: Date;
  sessionId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalLogs: number;
  logsByCategory: Record<string, number>;
  logsByLevel: Record<string, number>;
  logsByActor: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
  recentActivity: AuditLog[];
  timeRange: { start: Date; end: Date };
}

export class AuditLogger {
  private static instance: AuditLogger;
  private batchSize: number = 100;
  private flushInterval: number = 5000; // 5 seconds
  private pendingLogs: AuditLog[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startFlushTimer();
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log an action with full details
   */
  async logAction(
    actor: string,
    action: string,
    result: any,
    options: {
      input?: any;
      sessionId?: string;
      executionId?: string;
      category?: 'chat' | 'plugin' | 'commit_api' | 'zhupi_api' | 'security' | 'system';
      level?: 'info' | 'warning' | 'error' | 'critical';
      metadata?: any;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<string> {
    const {
      input,
      sessionId,
      executionId,
      category = this.inferCategory(action),
      level = this.inferLevel(action, result),
      metadata,
      ipAddress,
      userAgent
    } = options;

    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      actor,
      action,
      input: input || null,
      result,
      timestamp: new Date(),
      sessionId,
      executionId,
      category,
      level,
      metadata,
      ipAddress,
      userAgent
    };

    // Add to pending logs for batch processing
    this.pendingLogs.push(auditLog);

    // Log to console for immediate visibility
    this.logToConsole(auditLog);

    // Flush immediately for critical logs
    if (level === 'critical' || level === 'error') {
      await this.flushLogs();
    }

    return auditLog.id;
  }

  /**
   * Log chat interaction
   */
  async logChat(
    actor: string,
    input: string,
    output: string,
    sessionId: string,
    metadata?: any
  ): Promise<string> {
    return await this.logAction(actor, 'chat', {
      input,
      output,
      sessionId
    }, {
      input,
      sessionId,
      category: 'chat',
      level: 'info',
      metadata
    });
  }

  /**
   * Log plugin execution
   */
  async logPluginExecution(
    actor: string,
    pluginName: string,
    parameters: any,
    result: any,
    executionId: string,
    sessionId?: string
  ): Promise<string> {
    return await this.logAction(actor, `plugin_${pluginName}`, result, {
      input: parameters,
      executionId,
      sessionId,
      category: 'plugin',
      level: result.success ? 'info' : 'error',
      metadata: {
        pluginName,
        executionTime: result.executionTime,
        success: result.success
      }
    });
  }

  /**
   * Log API execution
   */
  async logApiExecution(
    actor: string,
    apiType: 'commit_api' | 'zhupi_api',
    action: string,
    parameters: any,
    result: any,
    executionId: string,
    sessionId?: string
  ): Promise<string> {
    return await this.logAction(actor, `${apiType}_${action}`, result, {
      input: parameters,
      executionId,
      sessionId,
      category: apiType,
      level: result.success ? 'info' : 'error',
      metadata: {
        apiType,
        action,
        executionTime: result.executionTime || result.responseTime,
        success: result.success
      }
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    actor: string,
    event: string,
    details: any,
    level: 'warning' | 'error' | 'critical' = 'warning',
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return await this.logAction(actor, `security_${event}`, details, {
      category: 'security',
      level,
      ipAddress,
      userAgent,
      metadata: {
        securityEvent: event,
        severity: level
      }
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filter: AuditFilter = {}): Promise<{
    logs: AuditLog[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const where: any = {};

      // Build where clause
      if (filter.actor) {
        where.actor = filter.actor;
      }
      
      if (filter.action) {
        where.action = { contains: filter.action };
      }
      
      if (filter.category) {
        where.category = filter.category;
      }
      
      if (filter.level) {
        where.level = filter.level;
      }
      
      if (filter.sessionId) {
        where.sessionId = filter.sessionId;
      }
      
      if (filter.startDate || filter.endDate) {
        where.timestamp = {};
        if (filter.startDate) {
          where.timestamp.gte = filter.startDate;
        }
        if (filter.endDate) {
          where.timestamp.lte = filter.endDate;
        }
      }

      const limit = filter.limit || 50;
      const offset = filter.offset || 0;

      // Get total count
      const total = await db.auditLog.count({ where });

      // Get logs
      const logs = await db.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset
      });

      return {
        logs: logs.map(this.formatAuditLog),
        total,
        hasMore: offset + logs.length < total
      };

    } catch (error) {
      console.error('❌ Failed to get audit logs:', error);
      return {
        logs: [],
        total: 0,
        hasMore: false
      };
    }
  }

  /**
   * Get user actions
   */
  async getUserActions(user: string, limit: number = 20): Promise<any[]> {
    return await this.getAuditLogs({
      actor: user,
      limit
    });
  }

  /**
   * Get session logs
   */
  async getSessionLogs(sessionId: string, limit: number = 50): Promise<any[]> {
    return await this.getAuditLogs({
      sessionId,
      limit
    });
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(days: number = 7): Promise<AuditStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await db.auditLog.findMany({
        where: {
          timestamp: {
            gte: startDate
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 1000
      });

      const stats: AuditStats = {
        totalLogs: logs.length,
        logsByCategory: {},
        logsByLevel: {},
        logsByActor: {},
        topActions: [],
        recentActivity: [],
        timeRange: { start: startDate, end: new Date() }
      };

      // Process logs for statistics
      for (const log of logs) {
        const formattedLog = this.formatAuditLog(log);
        
        // Count by category
        stats.logsByCategory[formattedLog.category] = 
          (stats.logsByCategory[formattedLog.category] || 0) + 1;
        
        // Count by level
        stats.logsByLevel[formattedLog.level] = 
          (stats.logsByLevel[formattedLog.level] || 0) + 1;
        
        // Count by actor
        stats.logsByActor[formattedLog.actor] = 
          (stats.logsByActor[formattedLog.actor] || 0) + 1;
      }

      // Get top actions
      const actionCounts: Record<string, number> = {};
      for (const log of logs) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      }
      
      stats.topActions = Object.entries(actionCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      // Get recent activity
      stats.recentActivity = logs
        .slice(0, 10)
        .map(this.formatAuditLog);

      return stats;

    } catch (error) {
      console.error('❌ Failed to get audit stats:', error);
      return {
        totalLogs: 0,
        logsByCategory: {},
        logsByLevel: {},
        logsByActor: {},
        topActions: [],
        recentActivity: [],
        timeRange: { start: new Date(), end: new Date() }
      };
    }
  }

  /**
   * Search audit logs
   */
  async searchAuditLogs(query: string, limit: number = 20): Promise<AuditLog[]> {
    try {
      const logs = await db.auditLog.findMany({
        where: {
          OR: [
            { action: { contains: query } },
            { actor: { contains: query } },
            { 
              metadata: {
                path: [],
                string_contains: query
              }
            }
          ]
        },
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return logs.map(this.formatAuditLog);

    } catch (error) {
      console.error('❌ Failed to search audit logs:', error);
      return [];
    }
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(filter: AuditFilter = {}): Promise<{
    data: AuditLog[];
    exportedAt: Date;
    filter: AuditFilter;
    totalCount: number;
  }> {
    const { logs, total } = await this.getAuditLogs({
      ...filter,
      limit: 10000 // Large limit for export
    });

    return {
      data: logs,
      exportedAt: new Date(),
      filter,
      totalCount: total
    };
  }

  /**
   * Cleanup old audit logs
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      console.log(`✅ Cleaned up ${result.count} old audit logs`);
      return result.count;

    } catch (error) {
      console.error('❌ Failed to cleanup old audit logs:', error);
      return 0;
    }
  }

  /**
   * Flush pending logs to database
   */
  private async flushLogs(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      // Batch insert logs
      await db.auditLog.createMany({
        data: logsToFlush.map(log => ({
          id: log.id,
          actor: log.actor,
          action: log.action,
          input: log.input,
          result: log.result,
          timestamp: log.timestamp,
          sessionId: log.sessionId,
          executionId: log.executionId,
          category: log.category,
          level: log.level,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent
        }))
      });

      console.log(`✅ Flushed ${logsToFlush.length} audit logs to database`);

    } catch (error) {
      console.error('❌ Failed to flush audit logs:', error);
      // Re-add failed logs to pending for retry
      this.pendingLogs.unshift(...logsToFlush);
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  /**
   * Log to console for immediate visibility
   */
  private logToConsole(log: AuditLog): void {
    const levelEmojis = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };

    const categoryEmojis = {
      chat: '💬',
      plugin: '🔌',
      commit_api: '🔧',
      zhupi_api: '🌐',
      security: '🔒',
      system: '⚙️'
    };

    const emoji = levelEmojis[log.level];
    const categoryEmoji = categoryEmojis[log.category];
    
    console.log(`${emoji} ${categoryEmoji} [${log.timestamp.toISOString()}] ${log.actor} -> ${log.action}`);
    
    if (log.level === 'error' || log.level === 'critical') {
      console.error('Details:', log.result);
    }
  }

  /**
   * Infer category from action
   */
  private inferCategory(action: string): 'chat' | 'plugin' | 'commit_api' | 'zhupi_api' | 'security' | 'system' {
    if (action.startsWith('plugin_')) return 'plugin';
    if (action.startsWith('commit_api_')) return 'commit_api';
    if (action.startsWith('zhupi_api_')) return 'zhupi_api';
    if (action.startsWith('security_')) return 'security';
    if (action === 'chat') return 'chat';
    return 'system';
  }

  /**
   * Infer level from action and result
   */
  private inferLevel(action: string, result: any): 'info' | 'warning' | 'error' | 'critical' {
    if (action.startsWith('security_')) return 'warning';
    if (result && result.success === false) return 'error';
    if (action.includes('restart') || action.includes('clear')) return 'warning';
    return 'info';
  }

  /**
   * Format audit log from database
   */
  private formatAuditLog(log: any): AuditLog {
    return {
      id: log.id,
      actor: log.actor,
      action: log.action,
      input: log.input,
      result: log.result,
      timestamp: log.timestamp,
      sessionId: log.sessionId,
      executionId: log.executionId,
      category: log.category,
      level: log.level,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent
    };
  }

  /**
   * Get system health from audit logs
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    lastActivity: Date | null;
    errorRate: number;
    criticalEvents: number;
  }> {
    try {
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const recentLogs = await db.auditLog.findMany({
        where: {
          timestamp: {
            gte: last24Hours
          }
        }
      });

      const totalLogs = recentLogs.length;
      const errorLogs = recentLogs.filter(log => 
        log.level === 'error' || log.level === 'critical'
      ).length;
      
      const criticalEvents = recentLogs.filter(log => 
        log.level === 'critical'
      ).length;

      const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
      const lastActivity = recentLogs.length > 0 ? 
        new Date(Math.max(...recentLogs.map(log => log.timestamp.getTime()))) : 
        null;

      const issues: string[] = [];
      
      if (errorRate > 10) {
        issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
      }
      
      if (criticalEvents > 0) {
        issues.push(`${criticalEvents} critical events in last 24 hours`);
      }
      
      if (!lastActivity || (Date.now() - lastActivity.getTime()) > 60 * 60 * 1000) {
        issues.push('No system activity in the last hour');
      }

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (criticalEvents > 0 || errorRate > 20) {
        status = 'critical';
      } else if (issues.length > 0) {
        status = 'warning';
      }

      return {
        status,
        issues,
        lastActivity,
        errorRate: parseFloat(errorRate.toFixed(2)),
        criticalEvents
      };

    } catch (error) {
      return {
        status: 'critical',
        issues: ['Failed to analyze system health'],
        lastActivity: null,
        errorRate: 100,
        criticalEvents: 1
      };
    }
  }

  /**
   * Destroy instance and cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining logs
    this.flushLogs();
  }
}