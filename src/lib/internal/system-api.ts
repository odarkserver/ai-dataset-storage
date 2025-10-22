import { db } from '@/lib/db';

export class SystemAPIService {
  private static instance: SystemAPIService;

  private constructor() {}

  static getInstance(): SystemAPIService {
    if (!SystemAPIService.instance) {
      SystemAPIService.instance = new SystemAPIService();
    }
    return SystemAPIService.instance;
  }

  async initializeAPIs() {
    const defaultAPIs = [
      {
        name: 'User Management',
        endpoint: '/api/internal/users',
        method: 'GET',
        description: 'Manage internal users',
        status: 'active',
        config: {
          authentication: 'required',
          rateLimit: 100,
          timeout: 5000
        }
      },
      {
        name: 'Session Control',
        endpoint: '/api/internal/sessions',
        method: 'POST',
        description: 'Control chat sessions',
        status: 'active',
        config: {
          authentication: 'required',
          rateLimit: 200,
          timeout: 3000
        }
      },
      {
        name: 'Model Status',
        endpoint: '/api/internal/models/status',
        method: 'GET',
        description: 'Check AI model status',
        status: 'active',
        config: {
          authentication: 'required',
          rateLimit: 50,
          timeout: 2000
        }
      },
      {
        name: 'Storage Manager',
        endpoint: '/api/internal/storage',
        method: 'GET',
        description: 'Manage local storage',
        status: 'active',
        config: {
          authentication: 'required',
          rateLimit: 30,
          timeout: 10000
        }
      },
      {
        name: 'Audit Logs',
        endpoint: '/api/internal/audit',
        method: 'GET',
        description: 'Access audit logs',
        status: 'active',
        config: {
          authentication: 'admin_required',
          rateLimit: 20,
          timeout: 5000
        }
      },
      {
        name: 'System Health',
        endpoint: '/api/internal/health',
        method: 'GET',
        description: 'System health check',
        status: 'active',
        config: {
          authentication: 'none',
          rateLimit: 1000,
          timeout: 1000
        }
      }
    ];

    for (const api of defaultAPIs) {
      await db.systemAPI.upsert({
        where: { name: api.name },
        update: api,
        create: api
      });
    }
  }

  async callAPI(apiName: string, data: any = {}, sessionId?: string) {
    const startTime = Date.now();
    let apiUsage: any = null;

    try {
      const api = await db.systemAPI.findUnique({
        where: { name: apiName }
      });

      if (!api || api.status !== 'active') {
        throw new Error(`API ${apiName} not available`);
      }

      // Create usage record
      apiUsage = await db.aPIUsage.create({
        data: {
          apiId: api.id,
          sessionId,
          request: data,
          status: 0 // Will be updated
        }
      });

      // Simulate API call (in real implementation, this would make actual HTTP requests)
      const response = await this.executeAPI(api, data);
      const responseTime = Date.now() - startTime;

      // Update usage record
      await db.aPIUsage.update({
        where: { id: apiUsage.id },
        data: {
          response,
          status: 200,
          responseTime
        }
      });

      return {
        success: true,
        data: response,
        api: api.name,
        usage: {
          responseTime,
          status: 200
        }
      };

    } catch (error) {
      if (apiUsage) {
        await db.aPIUsage.update({
          where: { id: apiUsage.id },
          data: {
            status: 500,
            response: { error: error instanceof Error ? error.message : 'Unknown error' }
          }
        });
      }
      throw error;
    }
  }

  private async executeAPI(api: any, data: any): Promise<any> {
    // Simulate different API responses based on the endpoint
    switch (api.name) {
      case 'User Management':
        return {
          users: [
            { id: '1', name: 'ODARK Admin', role: 'admin', status: 'active' },
            { id: '2', name: 'System User', role: 'system', status: 'active' }
          ],
          total: 2,
          timestamp: new Date().toISOString()
        };

      case 'Session Control':
        const sessions = await db.chatSession.findMany({
          take: 10,
          orderBy: { updatedAt: 'desc' },
          include: {
            _count: {
              select: { messages: true }
            }
          }
        });

        return {
          sessions: sessions.map(s => ({
            id: s.sessionId,
            messageCount: s._count.messages,
            lastActivity: s.updatedAt
          })),
          total: sessions.length,
          timestamp: new Date().toISOString()
        };

      case 'Model Status':
        const models = await db.aIModel.findMany({
          include: {
            _count: {
              select: { usage: true }
            }
          }
        });

        return {
          models: models.map(m => ({
            name: m.name,
            type: m.type,
            status: m.status,
            usageCount: m._count.usage
          })),
          total: models.length,
          timestamp: new Date().toISOString()
        };

      case 'Storage Manager':
        const storage = await db.localStorage.groupBy({
          by: ['type'],
          _count: {
            type: true
          }
        });

        return {
          storage: storage,
          totalEntries: storage.reduce((sum, s) => sum + s._count.type, 0),
          timestamp: new Date().toISOString()
        };

      case 'Audit Logs':
        const logs = await db.auditLog.findMany({
          take: 50,
          orderBy: { timestamp: 'desc' }
        });

        return {
          logs: logs.map(l => ({
            id: l.id,
            action: l.action,
            resource: l.resource,
            status: l.status,
            timestamp: l.timestamp
          })),
          total: logs.length,
          timestamp: new Date().toISOString()
        };

      case 'System Health':
        return {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
          services: {
            database: 'connected',
            ai_models: 'active',
            storage: 'available',
            apis: 'operational'
          }
        };

      default:
        throw new Error(`Unknown API: ${api.name}`);
    }
  }

  async getAPIStats() {
    const apis = await db.systemAPI.findMany({
      include: {
        usage: {
          take: 100,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    return apis.map(api => ({
      ...api,
      usageCount: api.usage.length,
      successRate: api.usage.length > 0 
        ? (api.usage.filter(u => u.status >= 200 && u.status < 300).length / api.usage.length) * 100 
        : 0,
      avgResponseTime: api.usage.length > 0
        ? api.usage.reduce((sum, u) => sum + (u.responseTime || 0), 0) / api.usage.length
        : 0
    }));
  }

  async getAPIUsage(apiName?: string, limit: number = 100) {
    const where = apiName 
      ? { api: { name: apiName } }
      : {};

    return await db.aPIUsage.findMany({
      where,
      include: {
        api: {
          select: {
            name: true,
            endpoint: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }
}