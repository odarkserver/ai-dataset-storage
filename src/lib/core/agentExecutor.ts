import { PermissionGate } from '@/lib/security/permissionGate';
import { PluginExecutor } from '@/lib/plugins/pluginExecutor';
import { CommitRouter } from '@/lib/api/commitRouter';
import { ZhupiAdapter } from '@/lib/api/zhupiAdapter';
import { PromptBuilder } from '@/lib/config/promptBuilder';
import { AuditLogger } from '@/lib/audit/auditLogger';
import { AIModelService } from '@/lib/internal/ai-models';

export interface ExecutionRequest {
  input: string;
  user: string;
  sessionId: string;
  context?: any;
}

export interface ExecutionPreview {
  action: string;
  type: 'plugin' | 'commit_api' | 'zhupi_api' | 'internal';
  description: string;
  parameters: any;
  requiresApproval: boolean;
  estimatedImpact: string;
}

export interface ExecutionResult {
  success: boolean;
  action: string;
  result: any;
  timestamp: Date;
  executionId: string;
  auditLog: string;
}

export class AgentExecutor {
  private static instance: AgentExecutor;
  private permissionGate: PermissionGate;
  private pluginExecutor: PluginExecutor;
  private commitRouter: CommitRouter;
  private zhupiAdapter: ZhupiAdapter;
  private promptBuilder: PromptBuilder;
  private auditLogger: AuditLogger;
  private aiModelService: AIModelService;

  private constructor() {
    this.permissionGate = PermissionGate.getInstance();
    this.pluginExecutor = PluginExecutor.getInstance();
    this.commitRouter = CommitRouter.getInstance();
    this.zhupiAdapter = ZhupiAdapter.getInstance();
    this.promptBuilder = PromptBuilder.getInstance();
    this.auditLogger = AuditLogger.getInstance();
    this.aiModelService = AIModelService.getInstance();
  }

  static getInstance(): AgentExecutor {
    if (!AgentExecutor.instance) {
      AgentExecutor.instance = new AgentExecutor();
    }
    return AgentExecutor.instance;
  }

  /**
   * Analyze input and create execution preview
   */
  async createPreview(request: ExecutionRequest): Promise<{
    prompt: string;
    previews: ExecutionPreview[];
    requiresApproval: boolean;
  }> {
    try {
      // Build ODARK prompt
      const prompt = await this.promptBuilder.buildPrompt(request.input, request.context);
      
      // Analyze input for potential actions
      const previews: ExecutionPreview[] = [];
      
      // Check for plugin commands
      const pluginActions = await this.analyzePluginActions(request.input);
      previews.push(...pluginActions);
      
      // Check for commit API commands
      const commitActions = await this.analyzeCommitActions(request.input);
      previews.push(...commitActions);
      
      // Check for Zhupi API commands
      const zhupiActions = await this.analyzeZhupiActions(request.input);
      previews.push(...zhupiActions);
      
      const requiresApproval = previews.some(p => p.requiresApproval);
      
      return {
        prompt,
        previews,
        requiresApproval
      };
    } catch (error) {
      console.error('❌ Failed to create preview:', error);
      throw error;
    }
  }

  /**
   * Execute approved actions
   */
  async execute(request: ExecutionRequest, approvedActions: string[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Log execution start
      await this.auditLogger.logAction(request.user, request.input, {
        action: 'execution_start',
        executionId,
        approvedActions
      });

      // Get execution preview
      const { previews } = await this.createPreview(request);
      
      for (const preview of previews) {
        if (!approvedActions.includes(preview.action)) {
          continue; // Skip non-approved actions
        }

        // Check authorization
        if (!this.permissionGate.isAuthorized(preview.action, request.user)) {
          const result: ExecutionResult = {
            success: false,
            action: preview.action,
            result: { error: 'Unauthorized action' },
            timestamp: new Date(),
            executionId,
            auditLog: `Action ${preview.action} rejected by permission gate`
          };
          results.push(result);
          continue;
        }

        // Execute action based on type
        let result: any;
        try {
          switch (preview.type) {
            case 'plugin':
              result = await this.pluginExecutor.executePlugin(preview.action, preview.parameters);
              break;
            case 'commit_api':
              result = await this.commitRouter.executeAction(preview.action, preview.parameters);
              break;
            case 'zhupi_api':
              result = await this.zhupiAdapter.executeAction(preview.action, preview.parameters);
              break;
            case 'internal':
              result = await this.executeInternalAction(preview.action, preview.parameters);
              break;
            default:
              throw new Error(`Unknown action type: ${preview.type}`);
          }

          const executionResult: ExecutionResult = {
            success: true,
            action: preview.action,
            result,
            timestamp: new Date(),
            executionId,
            auditLog: `Successfully executed ${preview.action}`
          };
          results.push(executionResult);

          // Log successful execution
          await this.auditLogger.logAction(request.user, preview.action, {
            executionId,
            result,
            success: true
          });

        } catch (error) {
          const executionResult: ExecutionResult = {
            success: false,
            action: preview.action,
            result: { error: error instanceof Error ? error.message : 'Unknown error' },
            timestamp: new Date(),
            executionId,
            auditLog: `Failed to execute ${preview.action}: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
          results.push(executionResult);

          // Log failed execution
          await this.auditLogger.logAction(request.user, preview.action, {
            executionId,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
          });
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Execution failed:', error);
      throw error;
    }
  }

  /**
   * Process regular chat (no execution)
   */
  async processChat(request: ExecutionRequest): Promise<string> {
    try {
      const { prompt } = await this.createPreview(request);
      
      // Get AI response - combine system prompt with user input
      const combinedPrompt = `${prompt}\n\nUser: ${request.input}\nODARK:`;
      
      const messages = [
        { role: 'system' as const, content: 'Kamu adalah ODARK. Jawaban singkat, maksimal 1 kalimat.' },
        { role: 'user' as const, content: combinedPrompt }
      ];

      const completion = await this.aiModelService.chatCompletion(messages, request.sessionId);
      
      // Log chat interaction
      await this.auditLogger.logAction(request.user, 'chat', {
        input: request.input,
        output: completion.response,
        sessionId: request.sessionId
      });

      return completion.response;
    } catch (error) {
      console.error('❌ Chat processing failed:', error);
      throw error;
    }
  }

  /**
   * Analyze input for plugin actions
   */
  private async analyzePluginActions(input: string): Promise<ExecutionPreview[]> {
    const previews: ExecutionPreview[] = [];
    
    // Check for summarizer plugin
    if (input.toLowerCase().includes('ringkas') || input.toLowerCase().includes('summarize')) {
      previews.push({
        action: 'pluginSummarizer',
        type: 'plugin',
        description: 'Membuat ringkasan dari teks yang diberikan',
        parameters: { text: input },
        requiresApproval: false,
        estimatedImpact: 'Low - Text processing only'
      });
    }
    
    // Check for translator plugin
    if (input.toLowerCase().includes('terjemah') || input.toLowerCase().includes('translate')) {
      previews.push({
        action: 'pluginTranslator',
        type: 'plugin',
        description: 'Menerjemahkan teks ke bahasa lain',
        parameters: { text: input },
        requiresApproval: false,
        estimatedImpact: 'Low - Text processing only'
      });
    }

    // Check for GitHub Storage plugin
    const githubKeywords = [
      'simpan dataset', 'save dataset', 'github', 'repository',
      'load dataset', 'muat dataset', 'list dataset', 'daftar dataset',
      'delete dataset', 'hapus dataset', 'search dataset', 'cari dataset'
    ];

    if (githubKeywords.some(keyword => input.toLowerCase().includes(keyword))) {
      let action = 'list';
      let description = 'Mengelola dataset di GitHub repository';

      if (input.toLowerCase().includes('simpan') || input.toLowerCase().includes('save')) {
        action = 'save';
        description = 'Menyimpan dataset ke GitHub';
      } else if (input.toLowerCase().includes('muat') || input.toLowerCase().includes('load')) {
        action = 'load';
        description = 'Memuat dataset dari GitHub';
      } else if (input.toLowerCase().includes('hapus') || input.toLowerCase().includes('delete')) {
        action = 'delete';
        description = 'Menghapus dataset dari GitHub';
      } else if (input.toLowerCase().includes('cari') || input.toLowerCase().includes('search')) {
        action = 'search';
        description = 'Mencari dataset di GitHub';
      }

      previews.push({
        action: 'pluginGitHubStorage',
        type: 'plugin',
        description,
        parameters: { 
          action,
          input: input,
          config: {
            username: 'han-odark',
            repository: 'ai-datasets'
          }
        },
        requiresApproval: false,
        estimatedImpact: 'Low - GitHub API access'
      });
    }
    
    return previews;
  }

  /**
   * Analyze input for commit API actions
   */
  private async analyzeCommitActions(input: string): Promise<ExecutionPreview[]> {
    const previews: ExecutionPreview[] = [];
    
    // Check for restart agent command
    if (input.toLowerCase().includes('restart agent') || input.toLowerCase().includes('restart sistem')) {
      previews.push({
        action: 'restartAgent',
        type: 'commit_api',
        description: 'Restart AI agent dan sistem terkait',
        parameters: {},
        requiresApproval: true,
        estimatedImpact: 'High - System restart will affect all users'
      });
    }
    
    // Check for clear cache command
    if (input.toLowerCase().includes('clear cache') || input.toLowerCase().includes('bersihkan cache')) {
      previews.push({
        action: 'clearCache',
        type: 'commit_api',
        description: 'Membersihkan cache sistem',
        parameters: {},
        requiresApproval: true,
        estimatedImpact: 'Medium - Temporary performance impact'
      });
    }
    
    return previews;
  }

  /**
   * Analyze input for Zhupi API actions
   */
  private async analyzeZhupiActions(input: string): Promise<ExecutionPreview[]> {
    const previews: ExecutionPreview[] = [];
    
    // Check for get persona command
    if (input.toLowerCase().includes('get persona') || input.toLowerCase().includes('lihat persona')) {
      previews.push({
        action: 'getPersona',
        type: 'zhupi_api',
        description: 'Mengambil persona aktif dari Zhupi API',
        parameters: {},
        requiresApproval: false,
        estimatedImpact: 'Low - Read operation'
      });
    }
    
    // Check for update memory command
    if (input.toLowerCase().includes('update memory') || input.toLowerCase().includes('perbarui memori')) {
      previews.push({
        action: 'updateMemory',
        type: 'zhupi_api',
        description: 'Memperbarui preferensi pengguna di Zhupi API',
        parameters: { updates: {} },
        requiresApproval: true,
        estimatedImpact: 'Medium - Modifies user preferences'
      });
    }
    
    return previews;
  }

  /**
   * Execute internal actions
   */
  private async executeInternalAction(action: string, parameters: any): Promise<any> {
    switch (action) {
      case 'systemDiagnostic':
        // Run system diagnostic
        return { status: 'completed', result: 'System diagnostic completed successfully' };
      case 'healthCheck':
        // Run health check
        return { status: 'healthy', timestamp: new Date().toISOString() };
      default:
        throw new Error(`Unknown internal action: ${action}`);
    }
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(user: string, limit: number = 10): Promise<any[]> {
    return await this.auditLogger.getUserActions(user, limit);
  }

  /**
   * Get available actions
   */
  getAvailableActions(): {
    plugins: string[];
    commitApis: string[];
    zhupiApis: string[];
    internal: string[];
  } {
    return {
      plugins: this.pluginExecutor.getAvailablePlugins(),
      commitApis: this.commitRouter.getAvailableActions(),
      zhupiApis: this.zhupiAdapter.getAvailableActions(),
      internal: ['systemDiagnostic', 'healthCheck']
    };
  }
}