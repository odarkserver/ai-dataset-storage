export interface PromptContext {
  sessionId?: string;
  userId?: string;
  previousMessages?: Array<{ role: string; content: string }>;
  currentPersona?: any;
  userPreferences?: any;
  systemStatus?: any;
}

export interface BuiltPrompt {
  systemPrompt: string;
  contextualPrompt: string;
  fullPrompt: string;
  metadata: {
    timestamp: Date;
    persona: string;
    style: string;
    language: string;
    contextIncluded: boolean;
  };
}

export class PromptBuilder {
  private static instance: PromptBuilder;
  private basePrompt: string;
  private styleTemplates: Record<string, string>;
  private contextualEnhancers: string[];

  private constructor() {
    this.basePrompt = this.getBasePrompt();
    this.styleTemplates = this.getStyleTemplates();
    this.contextualEnhancers = this.getContextualEnhancers();
  }

  static getInstance(): PromptBuilder {
    if (!PromptBuilder.instance) {
      PromptBuilder.instance = new PromptBuilder();
    }
    return PromptBuilder.instance;
  }

  /**
   * Get the base ODARK system prompt
   */
  private getBasePrompt(): string {
    return `
Kamu adalah ODARK.

ATURAN KRUSIAL:
- Jawaban MAKSIMAL 1 KALIMAT!
- Langsung ke intinya, tidak perlu basa-basi
- Contoh: "Sistem aktif." bukan "Hai! Sistem saya sudah berfungsi dengan baik. Ada yang bisa saya bantu?"

Plugin: summarizer, translator, githubStorage.
`.trim();
  }

  /**
   * Get style templates for different contexts
   */
  private getStyleTemplates(): Record<string, string> {
    return {
      operational: 'Respons teknis, langsung, dan fokus pada eksekusi.',
      elegant: 'Respons profesional, sopan, dan berkelas.',
      friendly: 'Respons hangat, ramah, dan mudah dimengerti.',
      analytical: 'Respons berbasis data, terstruktur, dan logis.',
      creative: 'Respons inspiratif, inovatif, dan penuh ide.'
    };
  }

  /**
   * Get contextual enhancers
   */
  private getContextualEnhancers(): string[] {
    return [
      'currentSession',
      'userHistory',
      'systemStatus',
      'activePlugins',
      'recentActions',
      'userPreferences',
      'timeContext',
      'securityLevel'
    ];
  }

  /**
   * Build complete prompt with context
   */
  async buildPrompt(userInput: string, context?: PromptContext): Promise<BuiltPrompt> {
    const timestamp = new Date();
    
    // Determine style based on input and context
    const style = this.determineStyle(userInput, context);
    
    // Build contextual enhancements
    const contextualEnhancement = this.buildContextualEnhancement(context);
    
    // Build system prompt with style
    const systemPrompt = this.buildSystemPrompt(style, contextualEnhancement);
    
    // Build contextual prompt
    const contextualPrompt = this.buildContextualPrompt(userInput, context);
    
    // Combine into full prompt
    const fullPrompt = `${systemPrompt}\n\n${contextualPrompt}`;

    return {
      systemPrompt,
      contextualPrompt,
      fullPrompt,
      metadata: {
        timestamp,
        persona: context?.currentPersona?.name || 'ODARK Assistant',
        style,
        language: 'Indonesian',
        contextIncluded: !!context
      }
    };
  }

  /**
   * Determine response style based on input and context
   */
  private determineStyle(userInput: string, context?: PromptContext): string {
    const input = userInput.toLowerCase();
    
    // Check for explicit style requests
    if (input.includes('formal') || input.includes('profesional')) return 'elegant';
    if (input.includes('ramah') || input.includes('santai')) return 'friendly';
    if (input.includes('analisis') || input.includes('data')) return 'analytical';
    if (input.includes('kreatif') || input.includes('ide')) return 'creative';
    if (input.includes('eksekusi') || input.includes('perintah')) return 'operational';
    
    // Determine based on user preferences
    if (context?.userPreferences?.responseStyle) {
      return context.userPreferences.responseStyle;
    }
    
    // Determine based on input content
    if (input.includes('restart') || input.includes('clear') || input.includes('execute')) {
      return 'operational';
    }
    
    if (input.includes('bantuan') || input.includes('tolong')) {
      return 'friendly';
    }
    
    if (input.includes('analisa') || input.includes('statistik')) {
      return 'analytical';
    }
    
    if (input.includes('buat') || input.includes('ide')) {
      return 'creative';
    }
    
    // Default style
    return 'elegant';
  }

  /**
   * Build contextual enhancement
   */
  private buildContextualEnhancement(context?: PromptContext): string {
    if (!context) return '';
    
    let enhancement = '';
    
    // Add user context
    if (context.userId) {
      enhancement += `\n👤 User: ${context.userId}`;
    }
    
    // Add time context
    const now = new Date();
    enhancement += `\n⏰ ${now.toLocaleString('id-ID', { 
      hour: '2-digit',
      minute: '2-digit'
    })}`;
    
    return enhancement;
  }

  /**
   * Build system prompt with style
   */
  private buildSystemPrompt(style: string, contextualEnhancement: string): string {
    let systemPrompt = this.basePrompt;
    
    // Add style template
    if (this.styleTemplates[style]) {
      systemPrompt += `\n\nGaya: ${this.styleTemplates[style]}`;
    }
    
    // Add contextual enhancement
    if (contextualEnhancement) {
      systemPrompt += `\n${contextualEnhancement}`;
    }
    
    // Add critical rule
    systemPrompt += `\n\nINGAT: 1 KALIMAT MAKSIMAL!`;
    
    return systemPrompt;
  }

  /**
   * Build contextual prompt
   */
  private buildContextualPrompt(userInput: string, context?: PromptContext): string {
    return `Input: ${userInput}`;
  }

  /**
   * Build prompt for specific action type
   */
  buildActionPrompt(action: string, parameters: any, context?: PromptContext): string {
    const actionPrompts: Record<string, string> = {
      'pluginSummarizer': `🔍 Ringkas teks: ${parameters.text || parameters}`,
      'pluginTranslator': `🌐 Terjemahkan ke ${parameters.targetLanguage || 'English'}: ${parameters.text || parameters}`,
      'restartAgent': `⚠️ Restart sistem - memerlukan persetujuan Han`,
      'clearCache': `🧹 Bersihkan cache - memerlukan persetujuan`,
      'getPersona': `👤 Ambil data persona dari Zhupi API`,
      'updateMemory': `🧠 Update preferensi user di Zhupi API`
    };
    
    return actionPrompts[action] || `**Aksi:** ${action}`;
  }

  /**
   * Get available styles
   */
  getAvailableStyles(): string[] {
    return Object.keys(this.styleTemplates);
  }

  /**
   * Get style template
   */
  getStyleTemplate(style: string): string | null {
    return this.styleTemplates[style] || null;
  }

  /**
   * Add custom style template
   */
  addStyleTemplate(name: string, template: string): void {
    this.styleTemplates[name] = template;
  }

  /**
   * Get prompt building statistics
   */
  getPromptStats(): {
    totalStyles: number;
    totalEnhancers: number;
    basePromptLength: number;
    availableStyles: string[];
  } {
    return {
      totalStyles: Object.keys(this.styleTemplates).length,
      totalEnhancers: this.contextualEnhancers.length,
      basePromptLength: this.basePrompt.length,
      availableStyles: Object.keys(this.styleTemplates)
    };
  }

  /**
   * Validate built prompt
   */
  validatePrompt(prompt: BuiltPrompt): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check prompt length
    if (prompt.fullPrompt.length > 10000) {
      issues.push('Prompt is too long (>10,000 characters)');
      suggestions.push('Consider reducing context or using shorter summaries');
    }
    
    // Check for required elements
    if (!prompt.fullPrompt.includes('ODARK')) {
      issues.push('Prompt missing ODARK identity');
    }
    
    if (!prompt.fullPrompt.includes('Han')) {
      suggestions.push('Consider mentioning Han authority for clarity');
    }
    
    // Check style consistency
    const styleKeywords = {
      operational: ['eksekusi', 'perintah', 'sistem'],
      elegant: ['profesional', 'berkelas', 'sopan'],
      friendly: ['ramah', 'hangat', 'nyaman'],
      analytical: ['data', 'analisis', 'statistik'],
      creative: ['ide', 'kreatif', 'inovatif']
    };
    
    const style = prompt.metadata.style;
    if (styleKeywords[style]) {
      const hasStyleKeywords = styleKeywords[style].some(keyword => 
        prompt.fullPrompt.toLowerCase().includes(keyword)
      );
      
      if (!hasStyleKeywords) {
        suggestions.push(`Consider adding ${style} style keywords to the prompt`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }
}