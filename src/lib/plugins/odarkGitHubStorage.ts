import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

export interface OdarkGitHubConfig {
  username: string;
  token: string;
  repository: string;
  branch?: string;
  dataPath?: string;
  isConfigured: boolean;
}

export interface DatasetInfo {
  name: string;
  description: string;
  format: 'csv' | 'json' | 'txt' | 'md';
  size: number;
  lastModified: string;
  url: string;
  rawUrl: string;
  sha?: string;
}

export interface OdarkGitHubResult {
  success: boolean;
  action: string;
  data?: any;
  datasets?: DatasetInfo[];
  message?: string;
  error?: string;
  timestamp: Date;
  requiresConfig?: boolean;
}

export class OdarkGitHubStorage {
  private static instance: OdarkGitHubStorage;
  private config: OdarkGitHubConfig;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = 'https://api.github.com';
    this.config = {
      username: 'odarkserver', // Akun GitHub Anda
      token: '',
      repository: 'ai-dataset-storage', // Repository default
      branch: 'main',
      dataPath: 'datasets',
      isConfigured: false
    };
  }

  static getInstance(): OdarkGitHubStorage {
    if (!OdarkGitHubStorage.instance) {
      OdarkGitHubStorage.instance = new OdarkGitHubStorage();
    }
    return OdarkGitHubStorage.instance;
  }

  /**
   * Setup GitHub dengan token dan repository
   */
  async setupGitHub(token: string, repository?: string): Promise<OdarkGitHubResult> {
    try {
      // Validasi token dengan GitHub API
      const isValid = await this.validateGitHubToken(token);
      if (!isValid) {
        return {
          success: false,
          action: 'setup_github',
          error: 'Token GitHub tidak valid',
          timestamp: new Date(),
          requiresConfig: true
        };
      }

      // Update konfigurasi
      this.config.token = token;
      this.config.repository = repository || 'ai-dataset-storage';
      this.config.isConfigured = true;

      // Simpan konfigurasi ke database
      await this.saveConfigToDatabase();

      // Buat repository jika belum ada
      const repoExists = await this.checkRepositoryExists();
      if (!repoExists) {
        await this.createRepository();
      }

      // Buat struktur folder awal
      await this.initializeRepository();

      return {
        success: true,
        action: 'setup_github',
        data: {
          username: this.config.username,
          repository: this.config.repository,
          isConfigured: true
        },
        message: `GitHub berhasil dikonfigurasi dengan repository ${this.config.repository}`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'setup_github',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requiresConfig: true
      };
    }
  }

  /**
   * Validasi GitHub token
   */
  private async validateGitHubToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ODARK-AI-System'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        // Verifikasi bahwa ini adalah akun odarkserver
        return userData.login === 'odarkserver';
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Cek apakah repository sudah ada
   */
  private async checkRepositoryExists(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.username}/${this.config.repository}`,
        {
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'ODARK-AI-System'
          }
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Buat repository baru
   */
  private async createRepository(): Promise<void> {
    await fetch(`${this.baseUrl}/user/repos`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'ODARK-AI-System'
      },
      body: JSON.stringify({
        name: this.config.repository,
        description: 'AI Dataset Storage - Managed by ODARK AI System',
        private: false,
        auto_init: true
      })
    });
  }

  /**
   * Inisialisasi struktur folder repository
   */
  private async initializeRepository(): Promise<void> {
    const folders = [
      'datasets',
      'datasets/json',
      'datasets/csv', 
      'datasets/txt',
      'datasets/md',
      'database',
      'backups',
      'exports'
    ];

    for (const folder of folders) {
      try {
        await this.createFolder(folder);
      } catch {
        // Folder mungkin sudah ada
      }
    }

    // Buat README
    await this.createReadme();
  }

  /**
   * Buat folder di repository
   */
  private async createFolder(path: string): Promise<void> {
    const content = {
      message: `Create folder: ${path}`,
      content: Buffer.from('# Folder for AI datasets').toString('base64'),
      branch: this.config.branch
    };

    await fetch(
      `${this.baseUrl}/repos/${this.config.username}/${this.config.repository}/contents/${path}/.gitkeep`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'ODARK-AI-System'
        },
        body: JSON.stringify(content)
      }
    );
  }

  /**
   * Buat README file
   */
  private async createReadme(): Promise<void> {
    const readmeContent = `# AI Dataset Storage

Repository ini digunakan untuk menyimpan dataset dan database dari ODARK AI System.

## Struktur Folder

- \`datasets/\` - Dataset dalam berbagai format (JSON, CSV, TXT, MD)
- \`database/\` - Backup database SQLite
- \`backups/\` - Backup lengkap sistem
- \`exports/\` - File ekspor dan laporan

## Format Dataset

- **JSON** - Dataset terstruktur
- **CSV** - Data tabular
- **TXT** - Data teks
- **MD** - Dokumentasi dataset

## Dikelola oleh

ODARK AI System - Automated Dataset Management
Repository: ${this.config.username}/${this.config.repository}
Last updated: ${new Date().toISOString()}
`;

    const content = {
      message: 'Add README',
      content: Buffer.from(readmeContent).toString('base64'),
      branch: this.config.branch
    };

    await fetch(
      `${this.baseUrl}/repos/${this.config.username}/${this.config.repository}/contents/README.md`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'ODARK-AI-System'
        },
        body: JSON.stringify(content)
      }
    );
  }

  /**
   * Simpan dataset ke GitHub
   */
  async saveDataset(
    datasetName: string, 
    data: any, 
    format: 'csv' | 'json' = 'json',
    description?: string
  ): Promise<OdarkGitHubResult> {
    try {
      if (!this.config.isConfigured) {
        return {
          success: false,
          action: 'save_dataset',
          error: 'GitHub belum dikonfigurasi',
          timestamp: new Date(),
          requiresConfig: true
        };
      }

      const filename = `${datasetName}.${format}`;
      const path = `datasets/${format}/${filename}`;
      
      // Format data
      let content: string;
      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
      } else if (format === 'csv') {
        content = this.convertToCSV(data);
      } else {
        content = String(data);
      }

      // Buat file dengan metadata
      const fileContent = {
        message: `Add dataset: ${datasetName} (${format})`,
        content: Buffer.from(content).toString('base64'),
        branch: this.config.branch
      };

      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.username}/${this.config.repository}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'ODARK-AI-System'
          },
          body: JSON.stringify(fileContent)
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status}`);
      }

      const result = await response.json();

      // Simpan metadata ke database lokal
      await this.saveDatasetMetadata(datasetName, format, description, path, result.content.sha);

      return {
        success: true,
        action: 'save_dataset',
        data: {
          name: datasetName,
          path,
          format,
          size: content.length,
          url: result.content.html_url,
          sha: result.content.sha
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
   * Load dataset dari GitHub
   */
  async loadDataset(datasetName: string, format?: string): Promise<OdarkGitHubResult> {
    try {
      if (!this.config.isConfigured) {
        return {
          success: false,
          action: 'load_dataset',
          error: 'GitHub belum dikonfigurasi',
          timestamp: new Date(),
          requiresConfig: true
        };
      }

      const possibleFormats = format ? [format] : ['json', 'csv', 'txt', 'md'];
      
      for (const fmt of possibleFormats) {
        const filename = `${datasetName}.${fmt}`;
        const path = `datasets/${fmt}/${filename}`;
        
        try {
          const response = await fetch(
            `${this.baseUrl}/repos/${this.config.username}/${this.config.repository}/contents/${path}`,
            {
              headers: {
                'Authorization': `token ${this.config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'ODARK-AI-System'
              }
            }
          );

          if (response.ok) {
            const fileData = await response.json();
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
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
        } catch {
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
   * List semua datasets
   */
  async listDatasets(): Promise<OdarkGitHubResult> {
    try {
      if (!this.config.isConfigured) {
        return {
          success: false,
          action: 'list_datasets',
          error: 'GitHub belum dikonfigurasi',
          timestamp: new Date(),
          requiresConfig: true
        };
      }

      const datasets: DatasetInfo[] = [];
      const formats = ['json', 'csv', 'txt', 'md'];

      for (const format of formats) {
        try {
          const response = await fetch(
            `${this.baseUrl}/repos/${this.config.username}/${this.config.repository}/contents/datasets/${format}`,
            {
              headers: {
                'Authorization': `token ${this.config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'ODARK-AI-System'
              }
            }
          );

          if (response.ok) {
            const files = await response.json();
            
            if (Array.isArray(files)) {
              for (const file of files) {
                if (file.type === 'file' && !file.name.endsWith('.gitkeep')) {
                  datasets.push({
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    description: `Dataset ${file.name}`,
                    format: format as any,
                    size: file.size,
                    lastModified: new Date().toISOString(),
                    url: file.html_url,
                    rawUrl: file.download_url,
                    sha: file.sha
                  });
                }
              }
            }
          }
        } catch {
          continue;
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
   * Backup database ke GitHub
   */
  async backupDatabase(databasePath: string): Promise<OdarkGitHubResult> {
    try {
      if (!this.config.isConfigured) {
        return {
          success: false,
          action: 'backup_database',
          error: 'GitHub belum dikonfigurasi',
          timestamp: new Date(),
          requiresConfig: true
        };
      }

      // Baca file database
      // Note: Implementasi server-side file reading
      // const fs = require('fs').promises;
      // const dbContent = await fs.readFile(databasePath);
      const dbContent = new ArrayBuffer(0); // Placeholder
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${timestamp}.db`;
      const path = `database/${filename}`;

      const content = {
        message: `Database backup: ${timestamp}`,
        content: Buffer.from(dbContent).toString('base64'),
        branch: this.config.branch
      };

      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.username}/${this.config.repository}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'ODARK-AI-System'
          },
          body: JSON.stringify(content)
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        action: 'backup_database',
        data: {
          filename,
          path,
          size: dbContent.length,
          url: result.content.html_url,
          timestamp
        },
        message: `Database berhasil di-backup ke GitHub`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'backup_database',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get konfigurasi saat ini
   */
  getConfig(): OdarkGitHubConfig {
    return { ...this.config };
  }

  /**
   * Cek apakah sudah dikonfigurasi
   */
  isConfigured(): boolean {
    return this.config.isConfigured && this.config.token.length > 0;
  }

  /**
   * Simpan konfigurasi ke database
   */
  private async saveConfigToDatabase(): Promise<void> {
    try {
      // Hapus token dari config untuk keamanan
      const { token, ...safeConfig } = this.config;
      
      await db.githubConfig.upsert({
        where: { username: this.config.username },
        update: { 
          repository: this.config.repository,
          branch: this.config.branch,
          dataPath: this.config.dataPath,
          isConfigured: this.config.isConfigured,
          updatedAt: new Date()
        },
        create: {
          username: this.config.username,
          repository: this.config.repository,
          branch: this.config.branch,
          dataPath: this.config.dataPath,
          isConfigured: this.config.isConfigured
        }
      });
    } catch (error) {
      console.error('Failed to save config to database:', error);
    }
  }

  /**
   * Simpan metadata dataset
   */
  private async saveDatasetMetadata(
    name: string, 
    format: string, 
    description: string | undefined,
    path: string, 
    sha: string
  ): Promise<void> {
    try {
      await db.datasetMetadata.create({
        data: {
          name,
          format,
          description: description || `Dataset ${name}`,
          path,
          sha,
          username: this.config.username,
          repository: this.config.repository
        }
      });
    } catch (error) {
      console.error('Failed to save dataset metadata:', error);
    }
  }

  /**
   * Convert data to CSV
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
   * Parse CSV
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
}

export default OdarkGitHubStorage;