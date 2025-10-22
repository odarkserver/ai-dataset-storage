import ZAI from 'z-ai-web-dev-sdk';
import { LocalStorageService } from '@/lib/internal/local-storage';

export interface ZhupiAction {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  category: 'persona' | 'memory' | 'preferences' | 'analytics';
  requiresAuth: boolean;
  execute: (params: any) => Promise<any>;
  validate?: (params: any) => boolean;
}

export interface ZhupiResult {
  success: boolean;
  action: string;
  result: any;
  timestamp: Date;
  responseTime: number;
  apiEndpoint: string;
  error?: string;
}

export class ZhupiAdapter {
  private static instance: ZhupiAdapter;
  private actions: Map<string, ZhupiAction> = new Map();
  private executionHistory: ZhupiResult[] = [];
  private localStorageService: LocalStorageService;
  private apiKey: string;
  private baseUrl: string;

  private constructor() {
    this.localStorageService = LocalStorageService.getInstance();
    this.apiKey = process.env.ZHUPI_API_KEY || 'zhupi-dev-key-2024';
    this.baseUrl = process.env.ZHUPI_API_URL || 'https://api.zhupi.ai/v1';
    this.initializeZhupiActions();
  }

  static getInstance(): ZhupiAdapter {
    if (!ZhupiAdapter.instance) {
      ZhupiAdapter.instance = new ZhupiAdapter();
    }
    return ZhupiAdapter.instance;
  }

  /**
   * Initialize Zhupi API actions
   */
  private initializeZhupiActions(): void {
    // Get Persona Action
    this.actions.set('getPersona', {
      name: 'getPersona',
      description: 'Mengambil persona aktif dari Zhupi API',
      method: 'GET',
      endpoint: '/persona/current',
      category: 'persona',
      requiresAuth: true,
      validate: (params: any) => {
        return true; // No parameters required
      },
      execute: async (params: any) => {
        return await this.getPersona(params);
      }
    });

    // Update Memory Action
    this.actions.set('updateMemory', {
      name: 'updateMemory',
      description: 'Memperbarui preferensi pengguna di Zhupi API',
      method: 'POST',
      endpoint: '/memory/update',
      category: 'memory',
      requiresAuth: true,
      validate: (params: any) => {
        return params && params.updates && typeof params.updates === 'object';
      },
      execute: async (params: any) => {
        return await this.updateMemory(params);
      }
    });

    // Get User Preferences Action
    this.actions.set('getUserPreferences', {
      name: 'getUserPreferences',
      description: 'Mengambil preferensi pengguna dari Zhupi API',
      method: 'GET',
      endpoint: '/preferences',
      category: 'preferences',
      requiresAuth: true,
      validate: (params: any) => {
        return params && params.userId && typeof params.userId === 'string';
      },
      execute: async (params: any) => {
        return await this.getUserPreferences(params);
      }
    });

    // Set User Preferences Action
    this.actions.set('setUserPreferences', {
      name: 'setUserPreferences',
      description: 'Menyimpan preferensi pengguna ke Zhupi API',
      method: 'POST',
      endpoint: '/preferences',
      category: 'preferences',
      requiresAuth: true,
      validate: (params: any) => {
        return params && 
               params.userId && 
               params.preferences && 
               typeof params.preferences === 'object';
      },
      execute: async (params: any) => {
        return await this.setUserPreferences(params);
      }
    });

    // Get Analytics Action
    this.actions.set('getAnalytics', {
      name: 'getAnalytics',
      description: 'Mengambil analytics data dari Zhupi API',
      method: 'GET',
      endpoint: '/analytics',
      category: 'analytics',
      requiresAuth: true,
      validate: (params: any) => {
        return true; // Optional parameters
      },
      execute: async (params: any) => {
        return await this.getAnalytics(params);
      }
    });

    // Create Persona Action
    this.actions.set('createPersona', {
      name: 'createPersona',
      description: 'Membuat persona baru di Zhupi API',
      method: 'POST',
      endpoint: '/persona/create',
      category: 'persona',
      requiresAuth: true,
      validate: (params: any) => {
        return params && 
               params.name && 
               params.traits && 
               typeof params.name === 'string' &&
               typeof params.traits === 'object';
      },
      execute: async (params: any) => {
        return await this.createPersona(params);
      }
    });
  }

  /**
   * Execute a Zhupi API action
   */
  async executeAction(actionName: string, parameters: any): Promise<ZhupiResult> {
    const startTime = Date.now();
    const action = this.actions.get(actionName);
    
    if (!action) {
      return {
        success: false,
        action: actionName,
        result: null,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        apiEndpoint: 'unknown',
        error: `Zhupi action '${actionName}' not found`
      };
    }

    try {
      // Validate parameters
      if (action.validate && !action.validate(parameters)) {
        return {
          success: false,
          action: actionName,
          result: null,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          apiEndpoint: action.endpoint,
          error: 'Invalid parameters for Zhupi action'
        };
      }

      // Execute action
      const result = await action.execute(parameters);
      const responseTime = Date.now() - startTime;
      
      const zhupiResult: ZhupiResult = {
        success: true,
        action: actionName,
        result,
        timestamp: new Date(),
        responseTime,
        apiEndpoint: action.endpoint
      };

      // Store in history
      this.executionHistory.push(zhupiResult);
      
      // Keep history size manageable
      if (this.executionHistory.length > 100) {
        this.executionHistory = this.executionHistory.slice(-50);
      }

      console.log(`✅ Zhupi action '${actionName}' executed successfully in ${responseTime}ms`);
      return zhupiResult;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const zhupiResult: ZhupiResult = {
        success: false,
        action: actionName,
        result: null,
        timestamp: new Date(),
        responseTime,
        apiEndpoint: action.endpoint,
        error: errorMessage
      };

      this.executionHistory.push(zhupiResult);
      
      console.error(`❌ Zhupi action '${actionName}' execution failed: ${errorMessage}`);
      return zhupiResult;
    }
  }

  /**
   * Get persona implementation
   */
  private async getPersona(params: any): Promise<any> {
    console.log('👤 Fetching current persona from Zhupi API...');
    
    try {
      // Simulate API call to Zhupi
      // In real implementation, this would make actual HTTP request
      const mockPersona = {
        id: 'persona_12345',
        name: 'ODARK Assistant',
        traits: {
          personality: 'professional',
          tone: 'elegant',
          communication_style: 'concise',
          expertise: ['AI', 'system_operations', 'data_analysis']
        },
        preferences: {
          language: 'Indonesian',
          response_length: 'medium',
          formality: 'professional'
        },
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: new Date().toISOString(),
        status: 'active'
      };

      // Cache persona locally
      await this.localStorageService.set('current_persona', mockPersona, 'cache', 
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      );

      return {
        status: 'success',
        persona: mockPersona,
        timestamp: new Date().toISOString(),
        source: 'zhupi_api'
      };

    } catch (error) {
      // Try to get cached persona as fallback
      const cachedPersona = await this.localStorageService.get('current_persona');
      if (cachedPersona) {
        return {
          status: 'success',
          persona: cachedPersona,
          timestamp: new Date().toISOString(),
          source: 'cache',
          warning: 'Using cached persona - API unavailable'
        };
      }
      
      throw new Error(`Failed to fetch persona: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update memory implementation
   */
  private async updateMemory(params: any): Promise<any> {
    console.log('🧠 Updating memory in Zhupi API...');
    
    const { updates } = params;
    
    try {
      // Simulate API call to Zhupi
      const mockResponse = {
        status: 'success',
        updated: Object.keys(updates),
        timestamp: new Date().toISOString(),
        memoryId: 'mem_67890'
      };

      // Store update record locally
      await this.localStorageService.set('memory_update', {
        updates,
        timestamp: new Date().toISOString(),
        response: mockResponse
      }, 'system');

      return mockResponse;

    } catch (error) {
      throw new Error(`Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user preferences implementation
   */
  private async getUserPreferences(params: any): Promise<any> {
    console.log('⚙️ Fetching user preferences from Zhupi API...');
    
    const { userId } = params;
    
    try {
      // Simulate API call to Zhupi
      const mockPreferences = {
        userId,
        preferences: {
          theme: 'dark',
          language: 'id',
          notifications: true,
          autoSave: true,
          responseStyle: 'professional',
          maxHistory: 100
        },
        lastUpdated: new Date().toISOString()
      };

      // Cache preferences locally
      await this.localStorageService.set(`user_prefs_${userId}`, mockPreferences, 'cache',
        new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      );

      return {
        status: 'success',
        preferences: mockPreferences,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Try to get cached preferences as fallback
      const cachedPrefs = await this.localStorageService.get(`user_prefs_${userId}`);
      if (cachedPrefs) {
        return {
          status: 'success',
          preferences: cachedPrefs,
          timestamp: new Date().toISOString(),
          source: 'cache',
          warning: 'Using cached preferences - API unavailable'
        };
      }
      
      throw new Error(`Failed to fetch user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set user preferences implementation
   */
  private async setUserPreferences(params: any): Promise<any> {
    console.log('💾 Saving user preferences to Zhupi API...');
    
    const { userId, preferences } = params;
    
    try {
      // Simulate API call to Zhupi
      const mockResponse = {
        status: 'success',
        userId,
        savedPreferences: preferences,
        timestamp: new Date().toISOString(),
        preferenceId: 'pref_' + Date.now()
      };

      // Update local cache
      await this.localStorageService.set(`user_prefs_${userId}`, {
        userId,
        preferences,
        lastUpdated: new Date().toISOString()
      }, 'cache', new Date(Date.now() + 60 * 60 * 1000));

      return mockResponse;

    } catch (error) {
      throw new Error(`Failed to save user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get analytics implementation
   */
  private async getAnalytics(params: any): Promise<any> {
    console.log('📊 Fetching analytics from Zhupi API...');
    
    try {
      // Simulate API call to Zhupi
      const mockAnalytics = {
        period: params.period || '7d',
        data: {
          totalInteractions: 1250,
          averageResponseTime: 850,
          satisfactionScore: 4.7,
          topFeatures: [
            { feature: 'chat', usage: 890 },
            { feature: 'summarizer', usage: 234 },
            { feature: 'translator', usage: 126 }
          ],
          dailyStats: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            interactions: Math.floor(Math.random() * 200) + 50
          }))
        },
        timestamp: new Date().toISOString()
      };

      return {
        status: 'success',
        analytics: mockAnalytics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to fetch analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create persona implementation
   */
  private async createPersona(params: any): Promise<any> {
    console.log('🎭 Creating new persona in Zhupi API...');
    
    const { name, traits } = params;
    
    try {
      // Simulate API call to Zhupi
      const mockPersona = {
        id: 'persona_' + Date.now(),
        name,
        traits: {
          personality: traits.personality || 'professional',
          tone: traits.tone || 'neutral',
          communication_style: traits.communication_style || 'balanced',
          expertise: traits.expertise || []
        },
        preferences: {
          language: 'Indonesian',
          response_length: 'medium',
          formality: 'professional'
        },
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      return {
        status: 'success',
        persona: mockPersona,
        timestamp: new Date().toISOString(),
        message: `Persona '${name}' created successfully`
      };

    } catch (error) {
      throw new Error(`Failed to create persona: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make HTTP request to Zhupi API
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'ODARK-AI/1.0'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    // In a real implementation, this would make actual HTTP request
    // For now, we'll simulate the request
    console.log(`🌐 Making ${method} request to ${url}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    return {
      status: 'success',
      data: null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get available actions
   */
  getAvailableActions(): string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * Get action details
   */
  getActionDetails(actionName: string): ZhupiAction | null {
    return this.actions.get(actionName) || null;
  }

  /**
   * Get all actions info
   */
  getAllActionsInfo(): Array<{
    name: string;
    description: string;
    method: string;
    category: string;
    requiresAuth: boolean;
  }> {
    return Array.from(this.actions.values()).map(action => ({
      name: action.name,
      description: action.description,
      method: action.method,
      category: action.category,
      requiresAuth: action.requiresAuth
    }));
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 20): ZhupiResult[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get API statistics
   */
  getApiStats(): {
    totalActions: number;
    totalExecutions: number;
    successRate: number;
    averageResponseTime: number;
    actionUsage: Record<string, number>;
    categoryStats: Record<string, number>;
  } {
    const totalExecutions = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(r => r.success).length;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    
    const totalTime = this.executionHistory.reduce((sum, r) => sum + r.responseTime, 0);
    const averageResponseTime = totalExecutions > 0 ? totalTime / totalExecutions : 0;
    
    const actionUsage: Record<string, number> = {};
    const categoryStats: Record<string, number> = {};
    
    for (const result of this.executionHistory) {
      actionUsage[result.action] = (actionUsage[result.action] || 0) + 1;
      
      const action = this.actions.get(result.action);
      if (action) {
        categoryStats[action.category] = (categoryStats[action.category] || 0) + 1;
      }
    }

    return {
      totalActions: this.actions.size,
      totalExecutions,
      successRate: parseFloat(successRate.toFixed(2)),
      averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
      actionUsage,
      categoryStats
    };
  }

  /**
   * Test API connectivity
   */
  async testConnectivity(): Promise<{
    status: 'connected' | 'disconnected' | 'error';
    responseTime: number;
    timestamp: Date;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Test with a simple ping to the API
      await this.makeRequest('GET', '/ping');
      
      return {
        status: 'connected',
        responseTime: Date.now() - startTime,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}