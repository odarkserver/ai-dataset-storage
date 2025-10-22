import ZAI from 'z-ai-web-dev-sdk';

export interface GitHubStorageConfig {
  username: string;
  repository: string;
  token?: string;
  branch?: string;
  dataPath?: string;
}

export interface DatasetInfo {
  name: string;
  description: string;
  format: 'csv' | 'json' | 'txt' | 'md';
  size: number;
  lastModified: string;
  url: string;
  rawUrl: string;
}

export interface GitHubStorageResult {
  success: boolean;
  action: string;
  data?: any;
  datasets?: DatasetInfo[];
  message?: string;
  error?: string;
  timestamp: Date;
}

export class GitHubStorage {
  private static instance: GitHubStorage;
  private config: GitHubStorageConfig;
  private baseUrl: string;

  private constructor(config: GitHubStorageConfig) {
    this.config = {
      branch: 'main',
      dataPath: 'datasets',
      ...config
    };
    
    this.baseUrl = 'https://api.github.com';
  }

  static getInstance(config?: GitHubStorageConfig): GitHubStorage {
    if (!GitHubStorage.instance) {
      if (!config) {
        throw new Error('GitHubStorage config required for first initialization');
      }
      GitHubStorage.instance = new GitHubStorage(config);
    }
    return GitHubStorage.instance;
  }

  /**
   * Save dataset to GitHub repository
   */
  async saveDataset(
    datasetName: string, 
    data: any, 
    format: 'csv' | 'json' = 'json',
    description?: string
  ): Promise<GitHubStorageResult> {
    try {
      const filename = `${datasetName}.${format}`;
      const path = `${this.config.dataPath}/${filename}`;
      
      // Format data based on type
      let content: string;
      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
      } else if (format === 'csv') {
        content = this.convertToCSV(data);
      } else {
        content = String(data);
      }

      // For demo purposes, return success without actual GitHub API call
      if (!this.config.token || this.config.repository.includes('demo')) {
        return {
          success: true,
          action: 'save_dataset',
          data: {
            name: datasetName,
            path,
            format,
            size: content.length,
            url: `https://github.com/${this.config.username}/${this.config.repository}/blob/main/${path}`,
            sha: 'demo_sha_' + Math.random().toString(36).substr(2, 9),
            demo: true
          },
          message: `Dataset '${datasetName}' berhasil disimpan (mode demo)`,
          timestamp: new Date()
        };
      }

      // Create file content
      const fileContent = {
        message: `Add dataset: ${datasetName}`,
        content: Buffer.from(content).toString('base64'),
        branch: this.config.branch
      };

      // GitHub API call to create/update file
      const response = await this.makeGitHubRequest(
        `PUT /repos/${this.config.username}/${this.config.repository}/contents/${path}`,
        fileContent
      );

      return {
        success: true,
        action: 'save_dataset',
        data: {
          name: datasetName,
          path,
          format,
          size: content.length,
          url: response.content?.html_url,
          sha: response.content?.sha
        },
        message: `Dataset '${datasetName}' berhasil disimpan ke GitHub`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'save_dataset',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Load dataset from GitHub
   */
  async loadDataset(datasetName: string, format?: string): Promise<GitHubStorageResult> {
    try {
      // Try to find the file
      const possibleFormats = format ? [format] : ['json', 'csv', 'txt', 'md'];
      
      for (const fmt of possibleFormats) {
        const filename = `${datasetName}.${fmt}`;
        const path = `${this.config.dataPath}/${filename}`;
        
        try {
          const response = await this.makeGitHubRequest(
            `GET /repos/${this.config.username}/${this.config.repository}/contents/${path}`
          );

          if (response.content) {
            const content = Buffer.from(response.content.content, 'base64').toString('utf-8');
            let parsedData: any;

            if (fmt === 'json') {
              parsedData = JSON.parse(content);
            } else if (fmt === 'csv') {
              parsedData = this.parseCSV(content);
            } else {
              parsedData = content;
            }

            return {
              success: true,
              action: 'load_dataset',
              data: parsedData,
              message: `Dataset '${datasetName}' berhasil dimuat`,
              timestamp: new Date()
            };
          }
        } catch (fileError) {
          // Continue to next format
          continue;
        }
      }

      throw new Error(`Dataset '${datasetName}' tidak ditemukan`);

    } catch (error) {
      return {
        success: false,
        action: 'load_dataset',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * List all datasets in repository
   */
  async listDatasets(): Promise<GitHubStorageResult> {
    try {
      // For demo purposes, return sample datasets
      if (!this.config.token || this.config.repository.includes('demo')) {
        const demoDatasets: DatasetInfo[] = [
          {
            name: 'contoh-penjualan',
            description: 'Dataset penjualan produk',
            format: 'json',
            size: 1024,
            lastModified: new Date().toISOString(),
            url: `https://github.com/${this.config.username}/${this.config.repository}/blob/main/datasets/contoh-penjualan.json`,
            rawUrl: `https://raw.githubusercontent.com/${this.config.username}/${this.config.repository}/main/datasets/contoh-penjualan.json`
          },
          {
            name: 'data-pelanggan',
            description: 'Dataset data pelanggan',
            format: 'csv',
            size: 2048,
            lastModified: new Date().toISOString(),
            url: `https://github.com/${this.config.username}/${this.config.repository}/blob/main/datasets/data-pelanggan.csv`,
            rawUrl: `https://raw.githubusercontent.com/${this.config.username}/${this.config.repository}/main/datasets/data-pelanggan.csv`
          }
        ];

        return {
          success: true,
          action: 'list_datasets',
          datasets: demoDatasets,
          message: `Ditemukan ${demoDatasets.length} dataset (mode demo)`,
          timestamp: new Date()
        };
      }

      const response = await this.makeGitHubRequest(
        `GET /repos/${this.config.username}/${this.config.repository}/contents/${this.config.dataPath}`
      );

      const datasets: DatasetInfo[] = [];
      
      if (Array.isArray(response)) {
        for (const file of response) {
          if (file.type === 'file') {
            const format = file.name.split('.').pop() as any;
            datasets.push({
              name: file.name.replace(/\.[^/.]+$/, ''),
              description: `Dataset ${file.name}`,
              format,
              size: file.size,
              lastModified: new Date().toISOString(),
              url: file.html_url,
              rawUrl: file.download_url
            });
          }
        }
      }

      return {
        success: true,
        action: 'list_datasets',
        datasets,
        message: `Ditemukan ${datasets.length} dataset`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'list_datasets',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Delete dataset from GitHub
   */
  async deleteDataset(datasetName: string, format?: string): Promise<GitHubStorageResult> {
    try {
      const possibleFormats = format ? [format] : ['json', 'csv', 'txt', 'md'];
      
      for (const fmt of possibleFormats) {
        const filename = `${datasetName}.${fmt}`;
        const path = `${this.config.dataPath}/${filename}`;
        
        try {
          // Get file info first
          const fileResponse = await this.makeGitHubRequest(
            `GET /repos/${this.config.username}/${this.config.repository}/contents/${path}`
          );

          // Delete file
          const deleteResponse = await this.makeGitHubRequest(
            `DELETE /repos/${this.config.username}/${this.config.repository}/contents/${path}`,
            {
              message: `Delete dataset: ${datasetName}`,
              sha: fileResponse.sha,
              branch: this.config.branch
            }
          );

          return {
            success: true,
            action: 'delete_dataset',
            message: `Dataset '${datasetName}' berhasil dihapus`,
            timestamp: new Date()
          };

        } catch (fileError) {
          continue;
        }
      }

      throw new Error(`Dataset '${datasetName}' tidak ditemukan`);

    } catch (error) {
      return {
        success: false,
        action: 'delete_dataset',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Search datasets by name or content
   */
  async searchDatasets(query: string): Promise<GitHubStorageResult> {
    try {
      const listResult = await this.listDatasets();
      
      if (!listResult.success || !listResult.datasets) {
        return listResult;
      }

      const filteredDatasets = listResult.datasets.filter(dataset => 
        dataset.name.toLowerCase().includes(query.toLowerCase()) ||
        dataset.description.toLowerCase().includes(query.toLowerCase())
      );

      return {
        success: true,
        action: 'search_datasets',
        datasets: filteredDatasets,
        message: `Ditemukan ${filteredDatasets.length} dataset untuk query '${query}'`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'search_datasets',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(): Promise<GitHubStorageResult> {
    try {
      const repoResponse = await this.makeGitHubRequest(
        `GET /repos/${this.config.username}/${this.config.repository}`
      );

      const datasetsResult = await this.listDatasets();
      const datasetCount = datasetsResult.datasets?.length || 0;

      return {
        success: true,
        action: 'get_stats',
        data: {
          repository: repoResponse.full_name,
          description: repoResponse.description,
          stars: repoResponse.stargazers_count,
          forks: repoResponse.forks_count,
          openIssues: repoResponse.open_issues_count,
          createdAt: repoResponse.created_at,
          updatedAt: repoResponse.updated_at,
          size: repoResponse.size,
          datasetCount,
          language: repoResponse.language
        },
        message: 'Statistik repository berhasil diambil',
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'get_stats',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Make GitHub API request
   */
  private async makeGitHubRequest(endpoint: string, data?: any): Promise<any> {
    // Handle different endpoint formats
    let url: string;
    
    if (endpoint.startsWith('http')) {
      url = endpoint;
    } else if (endpoint.includes('/repos/')) {
      // Direct API call
      url = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    } else {
      // Construct from endpoint parts
      const cleanEndpoint = endpoint.replace(/^\/+/, '');
      url = `${this.baseUrl}/${cleanEndpoint}`;
    }
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'ODARK-AI-System'
    };

    if (this.config.token) {
      headers['Authorization'] = `token ${this.config.token}`;
    }

    const response = await fetch(url, {
      method: data ? 'POST' : 'GET',
      headers,
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`GitHub API Error: ${response.status} - ${errorData.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Parse CSV content
   */
  private parseCSV(csv: string): any[] {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }

    return data;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GitHubStorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): GitHubStorageConfig {
    return { ...this.config };
  }
}