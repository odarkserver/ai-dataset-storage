import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

export interface GitHubConnectorConfig {
  username: string;
  token: string;
  repository: string;
  branch: string;
  autoSetup: boolean;
  isConfigured: boolean;
  lastConnected?: Date;
}

export interface RepositoryInfo {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  createdAt: string;
  updatedAt: string;
  size: number;
  stars: number;
  forks: number;
  url: string;
  cloneUrl: string;
}

export interface GitHubConnectorResult {
  success: boolean;
  action: string;
  data?: any;
  repositories?: RepositoryInfo[];
  message?: string;
  error?: string;
  timestamp: Date;
  requiresToken?: boolean;
}

export class GitHubConnector {
  private static instance: GitHubConnector;
  private config: GitHubConnectorConfig;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = 'https://api.github.com';
    this.config = {
      username: 'odarkserver', // Akun GitHub Anda
      token: '',
      repository: 'ai-dataset-storage',
      branch: 'main',
      autoSetup: true,
      isConfigured: false
    };
  }

  static getInstance(): GitHubConnector {
    if (!GitHubConnector.instance) {
      GitHubConnector.instance = new GitHubConnector();
    }
    return GitHubConnector.instance;
  }

  /**
   * Hubungkan ke GitHub dengan token
   */
  async connectWithToken(token: string, repository?: string): Promise<GitHubConnectorResult> {
    try {
      // Validasi token
      const validationResult = await this.validateToken(token);
      if (!validationResult.success) {
        return validationResult;
      }

      // Update konfigurasi
      this.config.token = token;
      this.config.repository = repository || 'ai-dataset-storage';
      this.config.isConfigured = true;
      this.config.lastConnected = new Date();

      // Simpan ke database
      await this.saveConfig();

      // Auto setup repository jika diaktifkan
      if (this.config.autoSetup) {
        const setupResult = await this.autoSetupRepository();
        if (!setupResult.success) {
          return setupResult;
        }
      }

      // Test koneksi
      const testResult = await this.testConnection();
      if (!testResult.success) {
        return testResult;
      }

      return {
        success: true,
        action: 'connect_github',
        data: {
          username: this.config.username,
          repository: this.config.repository,
          isConfigured: true,
          lastConnected: this.config.lastConnected,
          repositoryInfo: testResult.data
        },
        message: `Berhasil terhubung ke GitHub sebagai ${this.config.username}`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'connect_github',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Validasi GitHub token
   */
  async validateToken(token: string): Promise<GitHubConnectorResult> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ODARK-AI-System'
        }
      });

      if (!response.ok) {
        return {
          success: false,
          action: 'validate_token',
          error: `Token tidak valid (${response.status})`,
          timestamp: new Date(),
          requiresToken: true
        };
      }

      const userData = await response.json();

      // Verifikasi bahwa ini adalah akun odarkserver
      if (userData.login !== 'odarkserver') {
        return {
          success: false,
          action: 'validate_token',
          error: `Token tidak cocok dengan akun odarkserver. Login: ${userData.login}`,
          timestamp: new Date()
        };
      }

      return {
        success: true,
        action: 'validate_token',
        data: {
          username: userData.login,
          name: userData.name,
          email: userData.email,
          avatar: userData.avatar_url,
          followers: userData.followers,
          following: userData.following,
          publicRepos: userData.public_repos
        },
        message: 'Token valid dan cocok dengan akun odarkserver',
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'validate_token',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        requiresToken: true
      };
    }
  }

  /**
   * Auto setup repository
   */
  async autoSetupRepository(): Promise<GitHubConnectorResult> {
    try {
      // Cek apakah repository sudah ada
      const repoExists = await this.checkRepositoryExists();
      
      if (!repoExists) {
        // Buat repository baru
        const createResult = await this.createRepository();
        if (!createResult.success) {
          return createResult;
        }
      }

      // Inisialisasi struktur folder
      await this.initializeRepositoryStructure();

      // Buat file konfigurasi
      await this.createConfigFiles();

      return {
        success: true,
        action: 'auto_setup_repository',
        data: {
          repository: this.config.repository,
          username: this.config.username,
          url: `https://github.com/${this.config.username}/${this.config.repository}`,
          created: !repoExists
        },
        message: `Repository ${this.config.repository} berhasil disiapkan`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'auto_setup_repository',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Cek apakah repository ada
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
  private async createRepository(): Promise<GitHubConnectorResult> {
    try {
      const response = await fetch(`${this.baseUrl}/user/repos`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'ODARK-AI-System'
        },
        body: JSON.stringify({
          name: this.config.repository,
          description: '🤖 AI Dataset Storage & Database Management - Powered by ODARK AI System\n\nRepository ini menyimpan dataset, backup database, dan konfigurasi sistem AI yang dikelola secara otomatis.',
          private: false,
          auto_init: true,
          gitignore_template: 'Node',
          license_template: 'mit'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gagal membuat repository: ${errorData.message || response.statusText}`);
      }

      const repoData = await response.json();

      return {
        success: true,
        action: 'create_repository',
        data: {
          name: repoData.name,
          fullName: repoData.full_name,
          url: repoData.html_url,
          cloneUrl: repoData.clone_url,
          createdAt: repoData.created_at
        },
        message: `Repository ${repoData.name} berhasil dibuat`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'create_repository',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Inisialisasi struktur folder repository
   */
  private async initializeRepositoryStructure(): Promise<void> {
    const folders = [
      'datasets',
      'datasets/json',
      'datasets/csv',
      'datasets/txt',
      'datasets/md',
      'database',
      'database/backups',
      'exports',
      'config',
      'logs',
      'temp'
    ];

    for (const folder of folders) {
      await this.createFolder(folder);
    }
  }

  /**
   * Buat folder di repository
   */
  private async createFolder(path: string): Promise<void> {
    try {
      const content = {
        message: `📁 Create folder: ${path}`,
        content: Buffer.from(`# ${path}\n\nFolder for ${path} - Managed by ODARK AI System\n\nCreated: ${new Date().toISOString()}`).toString('base64'),
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
    } catch (error) {
      console.error(`Failed to create folder ${path}:`, error);
    }
  }

  /**
   * Buat file konfigurasi
   */
  private async createConfigFiles(): Promise<void> {
    // README.md
    const readmeContent = `# 🤖 AI Dataset Storage - ODARK AI System

> Repository ini dikelola secara otomatis oleh ODARK AI System untuk penyimpanan dataset dan database.

## 📁 Struktur Folder

### 📊 /datasets
- **json/** - Dataset dalam format JSON
- **csv/** - Dataset dalam format CSV  
- **txt/** - Dataset dalam format teks
- **md/** - Dataset dalam format Markdown

### 🗄️ /database
- **backups/** - Backup database SQLite
- Database utama sistem AI

### 📤 /exports
- File ekspor dan laporan hasil analisis

### ⚙️ /config
- Konfigurasi sistem dan plugin

### 📝 /logs
- Log aktivitas sistem

### 🔄 /temp
- File sementara proses

## 🔗 Koneksi

- **Username:** \`${this.config.username}\`
- **Repository:** \`${this.config.repository}\`
- **Branch:** \`${this.config.branch}\`
- **Connected:** ${this.config.lastConnected?.toISOString() || 'Never'}

## ⚡ Auto-Setup

Repository ini disiapkan secara otomatis dengan:
- ✅ Struktur folder terorganisir
- ✅ File konfigurasi dasar
- ✅ Git ignore untuk file sensitif
- ✅ License MIT
- ✅ README documentation

## 🛠️ Dikelola oleh

**ODARK AI System** - Automated Dataset & Database Management
- Last updated: ${new Date().toISOString()}
- Version: 1.0.0

---

🚀 *Powered by [ODARK AI System](https://github.com/odarkserver)*
`;

    // .gitignore
    const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
*.db
*.sqlite
*.sqlite3

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Build outputs
dist/
build/
.next/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary files
temp/
tmp/
*.tmp

# AI Model files
*.pkl
*.h5
*.pb
*.onnx

# Sensitive data
secrets/
private/
*.key
*.pem
`;

    // package.json untuk repository
    const packageJsonContent = {
      name: "ai-dataset-storage",
      version: "1.0.0",
      description: "AI Dataset Storage & Database Management - ODARK AI System",
      scripts: {
        "backup": "node scripts/backup.js",
        "sync": "node scripts/sync.js",
        "clean": "node scripts/clean.js"
      },
      repository: {
        type: "git",
        url: `https://github.com/${this.config.username}/${this.config.repository}.git`
      },
      keywords: [
        "ai",
        "dataset",
        "storage",
        "database",
        "odark",
        "automation"
      ],
      author: this.config.username,
      license: "MIT"
    };

    // Buat file-file tersebut
    await this.createFile('README.md', readmeContent);
    await this.createFile('.gitignore', gitignoreContent);
    await this.createFile('package.json', JSON.stringify(packageJsonContent, null, 2));
  }

  /**
   * Buat file di repository
   */
  private async createFile(path: string, content: string): Promise<void> {
    try {
      const fileContent = {
        message: `📄 Create file: ${path}`,
        content: Buffer.from(content).toString('base64'),
        branch: this.config.branch
      };

      await fetch(
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
    } catch (error) {
      console.error(`Failed to create file ${path}:`, error);
    }
  }

  /**
   * Test koneksi ke GitHub
   */
  async testConnection(): Promise<GitHubConnectorResult> {
    try {
      if (!this.config.isConfigured) {
        return {
          success: false,
          action: 'test_connection',
          error: 'GitHub belum dikonfigurasi',
          timestamp: new Date(),
          requiresToken: true
        };
      }

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

      if (!response.ok) {
        throw new Error(`Koneksi gagal (${response.status})`);
      }

      const repoData = await response.json();

      return {
        success: true,
        action: 'test_connection',
        data: {
          name: repoData.name,
          fullName: repoData.full_name,
          description: repoData.description,
          private: repoData.private,
          createdAt: repoData.created_at,
          updatedAt: repoData.updated_at,
          size: repoData.size,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          url: repoData.html_url,
          cloneUrl: repoData.clone_url
        },
        message: 'Koneksi ke GitHub berhasil',
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'test_connection',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * List semua repository
   */
  async listRepositories(): Promise<GitHubConnectorResult> {
    try {
      if (!this.config.isConfigured) {
        return {
          success: false,
          action: 'list_repositories',
          error: 'GitHub belum dikonfigurasi',
          timestamp: new Date(),
          requiresToken: true
        };
      }

      const response = await fetch(`${this.baseUrl}/user/repos`, {
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ODARK-AI-System'
        }
      });

      if (!response.ok) {
        throw new Error(`Gagal mengambil daftar repository (${response.status})`);
      }

      const reposData = await response.json();

      const repositories: RepositoryInfo[] = reposData.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        size: repo.size,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        url: repo.html_url,
        cloneUrl: repo.clone_url
      }));

      return {
        success: true,
        action: 'list_repositories',
        repositories,
        message: `Ditemukan ${repositories.length} repository`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'list_repositories',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Disconnect dari GitHub
   */
  async disconnect(): Promise<GitHubConnectorResult> {
    try {
      // Hapus token dari memori
      this.config.token = '';
      this.config.isConfigured = false;
      this.config.lastConnected = undefined;

      // Update database
      await this.saveConfig();

      return {
        success: true,
        action: 'disconnect',
        data: { username: this.config.username },
        message: 'Berhasil disconnect dari GitHub',
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'disconnect',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get status koneksi
   */
  async getConnectionStatus(): Promise<GitHubConnectorResult> {
    try {
      const status = {
        isConfigured: this.config.isConfigured,
        username: this.config.username,
        repository: this.config.repository,
        branch: this.config.branch,
        lastConnected: this.config.lastConnected,
        autoSetup: this.config.autoSetup
      };

      if (this.config.isConfigured) {
        const testResult = await this.testConnection();
        return {
          success: true,
          action: 'get_status',
          data: {
            ...status,
            connectionTest: testResult.success,
            repositoryInfo: testResult.data
          },
          message: testResult.success ? 'Terhubung ke GitHub' : 'Koneksi terputus',
          timestamp: new Date()
        };
      }

      return {
        success: true,
        action: 'get_status',
        data: status,
        message: 'GitHub belum dikonfigurasi',
        timestamp: new Date(),
        requiresToken: true
      };

    } catch (error) {
      return {
        success: false,
        action: 'get_status',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Simpan konfigurasi ke database
   */
  private async saveConfig(): Promise<void> {
    try {
      // Hapus token untuk keamanan
      const { token, ...safeConfig } = this.config;
      
      await db.localStorage.upsert({
        where: { key: 'github_connector_config' },
        update: {
          value: safeConfig,
          updatedAt: new Date()
        },
        create: {
          key: 'github_connector_config',
          value: safeConfig,
          type: 'config'
        }
      });
    } catch (error) {
      console.error('Failed to save GitHub connector config:', error);
    }
  }

  /**
   * Load konfigurasi dari database
   */
  async loadConfig(): Promise<void> {
    try {
      const config = await db.localStorage.findUnique({
        where: { key: 'github_connector_config' }
      });

      if (config) {
        this.config = { ...this.config, ...config.value };
      }
    } catch (error) {
      console.error('Failed to load GitHub connector config:', error);
    }
  }

  /**
   * Get konfigurasi saat ini
   */
  getConfig(): GitHubConnectorConfig {
    return { ...this.config };
  }

  /**
   * Update konfigurasi
   */
  updateConfig(newConfig: Partial<GitHubConnectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default GitHubConnector;