import { db } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ShellAuditService {
  private static instance: ShellAuditService;

  private constructor() {}

  static getInstance(): ShellAuditService {
    if (!ShellAuditService.instance) {
      ShellAuditService.instance = new ShellAuditService();
    }
    return ShellAuditService.instance;
  }

  async executeCommand(
    command: string, 
    type: 'system' | 'file' | 'network' | 'database' = 'system',
    executedBy?: string,
    sessionId?: string,
    autoApprove: boolean = false
  ) {
    let shellCommand: any = null;

    try {
      // Validate command safety
      const validationResult = this.validateCommand(command, type);
      if (!validationResult.safe) {
        throw new Error(`Command validation failed: ${validationResult.reason}`);
      }

      // Create command record
      shellCommand = await db.shellCommand.create({
        data: {
          command,
          type,
          status: autoApprove ? 'approved' : 'pending',
          executedBy: executedBy || 'system'
        }
      });

      // Create audit log
      await this.createAuditLog({
        sessionId,
        commandId: shellCommand.id,
        action: 'command_execute',
        resource: `${type}:${command}`,
        details: {
          command,
          type,
          executedBy,
          autoApprove
        },
        status: 'pending'
      });

      if (!autoApprove) {
        return {
          id: shellCommand.id,
          status: 'pending',
          message: 'Command awaiting approval',
          requiresApproval: true
        };
      }

      // Execute command
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 // 1MB
      });
      const executionTime = Date.now() - startTime;

      // Update command record
      await db.shellCommand.update({
        where: { id: shellCommand.id },
        data: {
          status: 'executed',
          result: stdout,
          executedAt: new Date()
        }
      });

      // Create success audit log
      await this.createAuditLog({
        sessionId,
        commandId: shellCommand.id,
        action: 'command_execute',
        resource: `${type}:${command}`,
        details: {
          command,
          type,
          executedBy,
          executionTime,
          outputLength: stdout.length
        },
        status: 'success'
      });

      return {
        id: shellCommand.id,
        status: 'executed',
        result: stdout,
        stderr,
        executionTime,
        success: true
      };

    } catch (error) {
      if (shellCommand) {
        await db.shellCommand.update({
          where: { id: shellCommand.id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            executedAt: new Date()
          }
        });

        await this.createAuditLog({
          sessionId,
          commandId: shellCommand.id,
          action: 'command_execute',
          resource: `${type}:${command}`,
          details: {
            command,
            type,
            executedBy,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          status: 'failed'
        });
      }

      throw error;
    }
  }

  async approveCommand(commandId: string, approvedBy: string, sessionId?: string) {
    try {
      const command = await db.shellCommand.findUnique({
        where: { id: commandId }
      });

      if (!command) {
        throw new Error('Command not found');
      }

      if (command.status !== 'pending') {
        throw new Error('Command is not pending approval');
      }

      // Update command status
      await db.shellCommand.update({
        where: { id: commandId },
        data: {
          status: 'approved',
          executedBy: approvedBy
        }
      });

      // Create audit log
      await this.createAuditLog({
        sessionId,
        commandId,
        action: 'command_approve',
        resource: `command:${commandId}`,
        details: {
          command: command.command,
          type: command.type,
          approvedBy
        },
        status: 'success'
      });

      // Execute the approved command
      return await this.executeCommand(
        command.command,
        command.type as any,
        approvedBy,
        sessionId,
        true
      );

    } catch (error) {
      await this.createAuditLog({
        sessionId,
        commandId,
        action: 'command_approve',
        resource: `command:${commandId}`,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        status: 'failed'
      });
      throw error;
    }
  }

  async rejectCommand(commandId: string, rejectedBy: string, reason: string, sessionId?: string) {
    try {
      const command = await db.shellCommand.findUnique({
        where: { id: commandId }
      });

      if (!command) {
        throw new Error('Command not found');
      }

      if (command.status !== 'pending') {
        throw new Error('Command is not pending approval');
      }

      // Update command status
      await db.shellCommand.update({
        where: { id: commandId },
        data: {
          status: 'rejected',
          error: `Rejected by ${rejectedBy}: ${reason}`,
          executedBy: rejectedBy
        }
      });

      // Create audit log
      await this.createAuditLog({
        sessionId,
        commandId,
        action: 'command_reject',
        resource: `command:${commandId}`,
        details: {
          command: command.command,
          type: command.type,
          rejectedBy,
          reason
        },
        status: 'success'
      });

      return {
        id: commandId,
        status: 'rejected',
        reason,
        rejectedBy
      };

    } catch (error) {
      await this.createAuditLog({
        sessionId,
        commandId,
        action: 'command_reject',
        resource: `command:${commandId}`,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        status: 'failed'
      });
      throw error;
    }
  }

  private validateCommand(command: string, type: string): { safe: boolean; reason?: string } {
    // List of dangerous commands that should be blocked
    const dangerousCommands = [
      'rm -rf',
      'sudo rm',
      'format',
      'del /f',
      'shutdown',
      'reboot',
      'passwd',
      'su ',
      'sudo su',
      'chmod 777',
      'chown',
      'dd if=',
      'mkfs',
      'fdisk',
      'iptables',
      'crontab',
      'systemctl',
      'service',
      'init ',
      'killall',
      'pkill'
    ];

    // Check for dangerous commands
    for (const dangerous of dangerousCommands) {
      if (command.toLowerCase().includes(dangerous.toLowerCase())) {
        return {
          safe: false,
          reason: `Command contains potentially dangerous operation: ${dangerous}`
        };
      }
    }

    // Type-specific validation
    switch (type) {
      case 'system':
        // Allow basic system commands like ls, ps, whoami, etc.
        const allowedSystemCommands = ['ls', 'ps', 'whoami', 'pwd', 'date', 'uptime', 'df', 'free', 'uname'];
        const commandStart = command.split(' ')[0];
        if (!allowedSystemCommands.includes(commandStart)) {
          return {
            safe: false,
            reason: `System command '${commandStart}' is not in the allowed list`
          };
        }
        break;

      case 'file':
        // Allow file operations like cat, echo, mkdir (but not destructive ones)
        const allowedFileCommands = ['cat', 'echo', 'mkdir', 'touch', 'head', 'tail', 'grep', 'find'];
        const fileCommandStart = command.split(' ')[0];
        if (!allowedFileCommands.includes(fileCommandStart)) {
          return {
            safe: false,
            reason: `File command '${fileCommandStart}' is not in the allowed list`
          };
        }
        break;

      case 'network':
        // Allow network diagnostics like ping, curl (with restrictions)
        const allowedNetworkCommands = ['ping', 'curl', 'wget', 'nslookup', 'dig'];
        const networkCommandStart = command.split(' ')[0];
        if (!allowedNetworkCommands.includes(networkCommandStart)) {
          return {
            safe: false,
            reason: `Network command '${networkCommandStart}' is not in the allowed list`
          };
        }
        break;

      case 'database':
        // Database commands should be handled through the ORM, not shell
        return {
          safe: false,
          reason: 'Database operations should be performed through the ORM, not shell commands'
        };
    }

    return { safe: true };
  }

  private async createAuditLog(data: {
    sessionId?: string;
    commandId?: string;
    action: string;
    resource: string;
    details?: any;
    status: string;
  }) {
    await db.auditLog.create({
      data: {
        ...data,
        details: data.details || {},
        ipAddress: '127.0.0.1', // In real implementation, get from request
        userAgent: 'ODARK-Internal' // In real implementation, get from request
      }
    });
  }

  async getPendingCommands() {
    return await db.shellCommand.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  async getCommandHistory(limit: number = 100) {
    return await db.shellCommand.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        audits: {
          select: {
            action: true,
            status: true,
            timestamp: true
          }
        }
      }
    });
  }

  async getAuditLogs(filters?: {
    action?: string;
    status?: string;
    sessionId?: string;
    limit?: number;
  }) {
    const where: any = {};
    
    if (filters?.action) where.action = filters.action;
    if (filters?.status) where.status = filters.status;
    if (filters?.sessionId) where.sessionId = filters.sessionId;

    return await db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters?.limit || 100,
      include: {
        session: {
          select: {
            sessionId: true
          }
        },
        command: {
          select: {
            command: true,
            type: true,
            status: true
          }
        }
      }
    });
  }

  async getSystemStats() {
    const [totalCommands, pendingCommands, executedCommands, failedCommands, recentCommands] = await Promise.all([
      db.shellCommand.count(),
      db.shellCommand.count({ where: { status: 'pending' } }),
      db.shellCommand.count({ where: { status: 'executed' } }),
      db.shellCommand.count({ where: { status: 'failed' } }),
      db.shellCommand.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    const auditLogs = await db.auditLog.groupBy({
      by: ['action', 'status'],
      _count: {
        action: true
      },
      orderBy: {
        _count: {
          action: 'desc'
        }
      },
      take: 10
    });

    return {
      commands: {
        total: totalCommands,
        pending: pendingCommands,
        executed: executedCommands,
        failed: failedCommands,
        recent24h: recentCommands
      },
      topActions: auditLogs,
      systemHealth: {
        executionRate: totalCommands > 0 ? (executedCommands / totalCommands) * 100 : 0,
        pendingRate: totalCommands > 0 ? (pendingCommands / totalCommands) * 100 : 0
      }
    };
  }
}