import ZAI from 'z-ai-web-dev-sdk';
import { GitHubStorage } from './githubStorage';
import GitHubConnector from './githubConnector';
import DatabaseManager from './databaseManager';

export interface Plugin {
  name: string;
  description: string;
  version: string;
  execute: (params: any) => Promise<any>;
  validate?: (params: any) => boolean;
}

export interface PluginResult {
  success: boolean;
  plugin: string;
  result: any;
  executionTime: number;
  timestamp: Date;
  error?: string;
}

export class PluginExecutor {
  private static instance: PluginExecutor;
  private plugins: Map<string, Plugin> = new Map();
  private executionHistory: PluginResult[] = [];

  private constructor() {
    this.initializeDefaultPlugins();
  }

  static getInstance(): PluginExecutor {
    if (!PluginExecutor.instance) {
      PluginExecutor.instance = new PluginExecutor();
    }
    return PluginExecutor.instance;
  }

  /**
   * Initialize default plugins
   */
  private initializeDefaultPlugins(): void {
    // Summarizer Plugin
    this.plugins.set('pluginSummarizer', {
      name: 'pluginSummarizer',
      description: 'Membuat ringkasan dari teks yang diberikan menggunakan AI',
      version: '1.0.0',
      validate: (params: any) => {
        return params && typeof params.text === 'string' && params.text.length > 0;
      },
      execute: async (params: any) => {
        return await this.executeSummarizer(params);
      }
    });

    // Translator Plugin
    this.plugins.set('pluginTranslator', {
      name: 'pluginTranslator',
      description: 'Menerjemahkan teks ke bahasa lain menggunakan AI',
      version: '1.0.0',
      validate: (params: any) => {
        return params && 
               typeof params.text === 'string' && 
               params.text.length > 0 &&
               params.targetLanguage &&
               typeof params.targetLanguage === 'string';
      },
      execute: async (params: any) => {
        return await this.executeTranslator(params);
      }
    });

    // GitHub Storage Plugin
    this.plugins.set('pluginGitHubStorage', {
      name: 'pluginGitHubStorage',
      description: 'Menyimpan dan mengelola dataset di GitHub repository',
      version: '1.0.0',
      validate: (params: any) => {
        return params && 
               params.action && 
               typeof params.action === 'string' &&
               ['save', 'load', 'list', 'delete', 'search', 'stats'].includes(params.action);
      },
      execute: async (params: any) => {
        return await this.executeGitHubStorage(params);
      }
    });

    // GitHub Connector Plugin
    this.plugins.set('pluginGitHubConnector', {
      name: 'pluginGitHubConnector',
      description: 'Menghubungkan dan mengelola koneksi GitHub untuk akun odarkserver',
      version: '1.0.0',
      validate: (params: any) => {
        return params && 
               params.action && 
               typeof params.action === 'string' &&
               ['connect', 'disconnect', 'status', 'test', 'list_repos', 'setup'].includes(params.action);
      },
      execute: async (params: any) => {
        return await this.executeGitHubConnector(params);
      }
    });

    // Database Manager Plugin
    this.plugins.set('pluginDatabaseManager', {
      name: 'pluginDatabaseManager',
      description: 'Mengelola backup dan restore database dengan integrasi GitHub',
      version: '1.0.0',
      validate: (params: any) => {
        return params && 
               params.action && 
               typeof params.action === 'string' &&
               ['backup', 'restore', 'list', 'delete', 'sync', 'stats', 'setup'].includes(params.action);
      },
      execute: async (params: any) => {
        return await this.executeDatabaseManager(params);
      }
    });
  }

  /**
   * Execute a plugin
   */
  async executePlugin(pluginName: string, parameters: any): Promise<PluginResult> {
    const startTime = Date.now();
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      return {
        success: false,
        plugin: pluginName,
        result: null,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
        error: `Plugin '${pluginName}' not found`
      };
    }

    try {
      // Validate parameters
      if (plugin.validate && !plugin.validate(parameters)) {
        return {
          success: false,
          plugin: pluginName,
          result: null,
          executionTime: Date.now() - startTime,
          timestamp: new Date(),
          error: 'Invalid parameters for plugin'
        };
      }

      // Execute plugin
      const result = await plugin.execute(parameters);
      const executionTime = Date.now() - startTime;
      
      const pluginResult: PluginResult = {
        success: true,
        plugin: pluginName,
        result,
        executionTime,
        timestamp: new Date()
      };

      // Store in history
      this.executionHistory.push(pluginResult);
      
      // Keep history size manageable
      if (this.executionHistory.length > 100) {
        this.executionHistory = this.executionHistory.slice(-50);
      }

      console.log(`✅ Plugin '${pluginName}' executed successfully in ${executionTime}ms`);
      return pluginResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const pluginResult: PluginResult = {
        success: false,
        plugin: pluginName,
        result: null,
        executionTime,
        timestamp: new Date(),
        error: errorMessage
      };

      this.executionHistory.push(pluginResult);
      
      console.error(`❌ Plugin '${pluginName}' execution failed: ${errorMessage}`);
      return pluginResult;
    }
  }

  /**
   * Execute summarizer plugin
   */
  private async executeSummarizer(params: any): Promise<any> {
    try {
      const zai = await ZAI.create();
      
      const prompt = `
        Buat ringkasan yang jelas dan padat dari teks berikut dalam bahasa Indonesia:
        
        Teks:
        ${params.text}
        
        Ringkasan:
      `;

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Kamu adalah AI ahli dalam membuat ringkasan teks yang akurat dan informatif.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const summary = completion.choices[0]?.message?.content || 'Tidak dapat membuat ringkasan';
      
      return {
        originalText: params.text,
        summary: summary.trim(),
        originalLength: params.text.length,
        summaryLength: summary.length,
        compressionRatio: ((summary.length / params.text.length) * 100).toFixed(2) + '%'
      };

    } catch (error) {
      console.error('❌ Summarizer plugin error:', error);
      throw new Error('Failed to generate summary');
    }
  }

  /**
   * Execute translator plugin
   */
  private async executeTranslator(params: any): Promise<any> {
    try {
      const zai = await ZAI.create();
      
      const languageMap: Record<string, string> = {
        'inggris': 'English',
        'english': 'English',
        'mandarin': 'Chinese',
        'cina': 'Chinese',
        'jepang': 'Japanese',
        'japanese': 'Japanese',
        'korea': 'Korean',
        'korean': 'Korean',
        'arab': 'Arabic',
        'arabic': 'Arabic',
        'spanyol': 'Spanish',
        'spanish': 'Spanish',
        'prancis': 'French',
        'french': 'French',
        'jerman': 'German',
        'german': 'German'
      };

      const targetLanguage = languageMap[params.targetLanguage.toLowerCase()] || params.targetLanguage;
      
      const prompt = `
        Terjemahkan teks berikut dari bahasa Indonesia ke ${targetLanguage}:
        
        Teks asli:
        ${params.text}
        
        Terjemahan dalam ${targetLanguage}:
      `;

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `Kamu adalah penerjemah profesional yang ahli dalam menerjemahkan antara bahasa Indonesia dan ${targetLanguage}.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.2
      });

      const translation = completion.choices[0]?.message?.content || 'Tidak dapat menerjemahkan teks';
      
      return {
        originalText: params.text,
        translatedText: translation.trim(),
        sourceLanguage: 'Indonesian',
        targetLanguage: targetLanguage,
        originalLength: params.text.length,
        translatedLength: translation.length
      };

    } catch (error) {
      console.error('❌ Translator plugin error:', error);
      throw new Error('Failed to translate text');
    }
  }

  /**
   * Register a new plugin
   */
  registerPlugin(plugin: Plugin): boolean {
    if (this.plugins.has(plugin.name)) {
      console.warn(`⚠️ Plugin '${plugin.name}' already exists`);
      return false;
    }

    this.plugins.set(plugin.name, plugin);
    console.log(`✅ Plugin '${plugin.name}' registered successfully`);
    return true;
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginName: string): boolean {
    const removed = this.plugins.delete(pluginName);
    
    if (removed) {
      console.log(`✅ Plugin '${pluginName}' unregistered successfully`);
    } else {
      console.warn(`⚠️ Plugin '${pluginName}' not found`);
    }
    
    return removed;
  }

  /**
   * Get available plugins
   */
  getAvailablePlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get plugin details
   */
  getPluginDetails(pluginName: string): Plugin | null {
    return this.plugins.get(pluginName) || null;
  }

  /**
   * Get all plugins info
   */
  getAllPluginsInfo(): Array<{ name: string; description: string; version: string }> {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      description: plugin.description,
      version: plugin.version
    }));
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 20): PluginResult[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get plugin statistics
   */
  getPluginStats(): {
    totalPlugins: number;
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    pluginUsage: Record<string, number>;
  } {
    const totalExecutions = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(r => r.success).length;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    
    const totalTime = this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0);
    const averageExecutionTime = totalExecutions > 0 ? totalTime / totalExecutions : 0;
    
    const pluginUsage: Record<string, number> = {};
    for (const result of this.executionHistory) {
      pluginUsage[result.plugin] = (pluginUsage[result.plugin] || 0) + 1;
    }

    return {
      totalPlugins: this.plugins.size,
      totalExecutions,
      successRate: parseFloat(successRate.toFixed(2)),
      averageExecutionTime: parseFloat(averageExecutionTime.toFixed(2)),
      pluginUsage
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    console.log('✅ Plugin execution history cleared');
  }

  /**
   * Execute GitHub Storage plugin
   */
  private async executeGitHubStorage(params: any): Promise<any> {
    try {
      // Initialize GitHub Storage dengan config dari database atau default
      const config = params.config || {
        username: 'odarkserver',
        repository: 'ai-dataset-storage',
        branch: 'main',
        dataPath: 'datasets'
      };

      const githubStorage = GitHubStorage.getInstance(config);

      let result;

      switch (params.action) {
        case 'save':
          result = await githubStorage.saveDataset(
            params.datasetName,
            params.data,
            params.format || 'json',
            params.description
          );
          break;

        case 'load':
          result = await githubStorage.loadDataset(
            params.datasetName,
            params.format
          );
          break;

        case 'list':
          result = await githubStorage.listDatasets();
          break;

        case 'delete':
          result = await githubStorage.deleteDataset(
            params.datasetName,
            params.format
          );
          break;

        case 'search':
          result = await githubStorage.searchDatasets(params.query);
          break;

        case 'stats':
          result = await githubStorage.getRepositoryStats();
          break;

        default:
          throw new Error(`Invalid action: ${params.action}`);
      }

      return {
        action: params.action,
        githubResult: result,
        config: {
          username: config.username,
          repository: config.repository,
          dataPath: config.dataPath
        }
      };

    } catch (error) {
      console.error('❌ GitHub Storage plugin error:', error);
      throw new Error('Failed to execute GitHub Storage operation');
    }
  }

  /**
   * Execute GitHub Connector plugin
   */
  private async executeGitHubConnector(params: any): Promise<any> {
    try {
      const connector = GitHubConnector.getInstance();
      await connector.loadConfig();

      let result;

      switch (params.action) {
        case 'connect':
          result = await connector.connectWithToken(
            params.token, 
            params.repository
          );
          break;

        case 'disconnect':
          result = await connector.disconnect();
          break;

        case 'status':
          result = await connector.getConnectionStatus();
          break;

        case 'test':
          result = await connector.testConnection();
          break;

        case 'list_repos':
          result = await connector.listRepositories();
          break;

        case 'setup':
          result = await connector.autoSetupRepository();
          break;

        default:
          throw new Error(`Invalid action: ${params.action}`);
      }

      return {
        action: params.action,
        connectorResult: result,
        config: connector.getConfig()
      };

    } catch (error) {
      console.error('❌ GitHub Connector plugin error:', error);
      throw new Error('Failed to execute GitHub Connector operation');
    }
  }

  /**
   * Execute Database Manager plugin
   */
  private async executeDatabaseManager(params: any): Promise<any> {
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.initialize();

      let result;

      switch (params.action) {
        case 'backup':
          result = await dbManager.backupDatabase(params.type);
          break;

        case 'restore':
          result = await dbManager.restoreDatabase(params.backupId);
          break;

        case 'list':
          result = await dbManager.listBackups();
          break;

        case 'delete':
          result = await dbManager.deleteBackup(params.backupId);
          break;

        case 'sync':
          result = await dbManager.syncDatasetsToGitHub();
          break;

        case 'stats':
          result = await dbManager.getDatabaseStats();
          break;

        case 'setup':
          result = await dbManager.setup(params.config);
          break;

        default:
          throw new Error(`Invalid action: ${params.action}`);
      }

      return {
        action: params.action,
        databaseResult: result,
        config: dbManager.getConfig()
      };

    } catch (error) {
      console.error('❌ Database Manager plugin error:', error);
      throw new Error('Failed to execute Database Manager operation');
    }
  }

  /**
   * Test plugin functionality
   */
  async testPlugin(pluginName: string): Promise<{
    available: boolean;
    testResult?: PluginResult;
    error?: string;
  }> {
    const plugin = this.plugins.get(pluginName);
    
    if (!plugin) {
      return {
        available: false,
        error: `Plugin '${pluginName}' not found`
      };
    }

    try {
      let testParams: any;
      
      // Use test parameters based on plugin
      switch (pluginName) {
        case 'pluginSummarizer':
          testParams = {
            text: 'Ini adalah teks uji untuk plugin summarizer. Teks ini berisi beberapa kalimat yang akan diringkas oleh plugin untuk menguji fungsionalitasnya.'
          };
          break;
        case 'pluginTranslator':
          testParams = {
            text: 'Ini adalah teks uji untuk plugin translator.',
            targetLanguage: 'English'
          };
          break;
        case 'pluginGitHubStorage':
          testParams = {
            action: 'list',
            config: {
              username: 'odarkserver',
              repository: 'ai-dataset-storage'
            }
          };
          break;
        case 'pluginGitHubConnector':
          testParams = {
            action: 'status'
          };
          break;
        case 'pluginDatabaseManager':
          testParams = {
            action: 'stats'
          };
          break;
        default:
          return {
            available: true,
            error: 'No test parameters defined for this plugin'
          };
      }

      const testResult = await this.executePlugin(pluginName, testParams);
      
      return {
        available: true,
        testResult
      };

    } catch (error) {
      return {
        available: true,
        error: error instanceof Error ? error.message : 'Unknown test error'
      };
    }
  }

  /**
   * Health check for all plugins
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    plugins: Record<string, { available: boolean; lastTest?: Date; error?: string }>;
    timestamp: Date;
  }> {
    const results: Record<string, { available: boolean; lastTest?: Date; error?: string }> = {};
    let healthyCount = 0;
    
    for (const pluginName of this.plugins.keys()) {
      const test = await this.testPlugin(pluginName);
      results[pluginName] = {
        available: test.available,
        lastTest: new Date(),
        error: test.error
      };
      
      if (test.available && !test.error) {
        healthyCount++;
      }
    }

    const totalPlugins = this.plugins.size;
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (healthyCount === totalPlugins) {
      status = 'healthy';
    } else if (healthyCount > totalPlugins / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      plugins: results,
      timestamp: new Date()
    };
  }
}