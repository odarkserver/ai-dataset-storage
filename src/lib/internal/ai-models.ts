import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

export class AIModelService {
  private static instance: AIModelService;
  private zaiInstance: any = null;

  private constructor() {}

  static getInstance(): AIModelService {
    if (!AIModelService.instance) {
      AIModelService.instance = new AIModelService();
    }
    return AIModelService.instance;
  }

  async initializeZAI() {
    if (!this.zaiInstance) {
      this.zaiInstance = await ZAI.create();
    }
    return this.zaiInstance;
  }

  async initializeModels() {
    const defaultModels = [
      {
        name: 'ODARK-Chat',
        version: '1.0.0',
        type: 'chat',
        status: 'active',
        config: {
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        }
      },
      {
        name: 'ODARK-Image',
        version: '1.0.0',
        type: 'image',
        status: 'active',
        config: {
          size: '1024x1024',
          quality: 'standard'
        }
      },
      {
        name: 'ODARK-Search',
        version: '1.0.0',
        type: 'search',
        status: 'active',
        config: {
          max_results: 10,
          safe_search: 'moderate'
        }
      },
      {
        name: 'ODARK-Shell',
        version: '1.0.0',
        type: 'shell',
        status: 'active',
        config: {
          timeout: 30000,
          safe_mode: true
        }
      }
    ];

    for (const model of defaultModels) {
      await db.aIModel.upsert({
        where: { name: model.name },
        update: model,
        create: model
      });
    }
  }

  async chatCompletion(messages: any[], sessionId?: string) {
    const startTime = Date.now();
    let modelUsage: any = null;

    try {
      const model = await db.aIModel.findUnique({
        where: { name: 'ODARK-Chat' }
      });

      if (!model || model.status !== 'active') {
        throw new Error('Chat model not available');
      }

      // Create usage record
      modelUsage = await db.modelUsage.create({
        data: {
          modelId: model.id,
          sessionId,
          action: 'chat'
        }
      });

      const zai = await this.initializeZAI();
      const completion = await zai.chat.completions.create({
        messages,
        ...model.config
      });

      const responseTime = Date.now() - startTime;
      const response = completion.choices[0]?.message?.content || 'No response generated';

      // Update usage record
      await db.modelUsage.update({
        where: { id: modelUsage.id },
        data: {
          responseTime,
          success: true,
          tokens: completion.usage?.total_tokens
        }
      });

      return {
        response,
        model: model.name,
        usage: {
          tokens: completion.usage?.total_tokens,
          responseTime
        }
      };

    } catch (error) {
      if (modelUsage) {
        await db.modelUsage.update({
          where: { id: modelUsage.id },
          data: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
      throw error;
    }
  }

  async generateImage(prompt: string, sessionId?: string) {
    const startTime = Date.now();
    let modelUsage: any = null;

    try {
      const model = await db.aIModel.findUnique({
        where: { name: 'ODARK-Image' }
      });

      if (!model || model.status !== 'active') {
        throw new Error('Image model not available');
      }

      modelUsage = await db.modelUsage.create({
        data: {
          modelId: model.id,
          sessionId,
          action: 'generate'
        }
      });

      const zai = await this.initializeZAI();
      const response = await zai.images.generations.create({
        prompt,
        ...model.config
      });

      const responseTime = Date.now() - startTime;

      await db.modelUsage.update({
        where: { id: modelUsage.id },
        data: {
          responseTime,
          success: true
        }
      });

      return {
        image: response.data[0].base64,
        model: model.name,
        usage: {
          responseTime
        }
      };

    } catch (error) {
      if (modelUsage) {
        await db.modelUsage.update({
          where: { id: modelUsage.id },
          data: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
      throw error;
    }
  }

  async webSearch(query: string, sessionId?: string) {
    const startTime = Date.now();
    let modelUsage: any = null;

    try {
      const model = await db.aIModel.findUnique({
        where: { name: 'ODARK-Search' }
      });

      if (!model || model.status !== 'active') {
        throw new Error('Search model not available');
      }

      modelUsage = await db.modelUsage.create({
        data: {
          modelId: model.id,
          sessionId,
          action: 'search'
        }
      });

      const zai = await this.initializeZAI();
      const results = await zai.functions.invoke("web_search", {
        query,
        num: model.config?.max_results || 10
      });

      const responseTime = Date.now() - startTime;

      await db.modelUsage.update({
        where: { id: modelUsage.id },
        data: {
          responseTime,
          success: true
        }
      });

      return {
        results,
        model: model.name,
        usage: {
          responseTime
        }
      };

    } catch (error) {
      if (modelUsage) {
        await db.modelUsage.update({
          where: { id: modelUsage.id },
          data: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
      throw error;
    }
  }

  async getModelStats() {
    const models = await db.aIModel.findMany({
      include: {
        usage: {
          take: 100,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    return models.map(model => ({
      ...model,
      usageCount: model.usage.length,
      successRate: model.usage.length > 0 
        ? (model.usage.filter(u => u.success).length / model.usage.length) * 100 
        : 0,
      avgResponseTime: model.usage.length > 0
        ? model.usage.reduce((sum, u) => sum + (u.responseTime || 0), 0) / model.usage.length
        : 0
    }));
  }
}