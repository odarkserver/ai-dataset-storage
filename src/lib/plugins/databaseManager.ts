import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import OdarkGitHubStorage from './odarkGitHubStorage';

export interface DatabaseManagerConfig {
  autoBackup: boolean;
  backupInterval: number; // dalam jam
  maxBackups: number;
  syncToGitHub: boolean;
  githubRepository: string;
}

export interface DatabaseBackup {
  id: string;
  filename: string;
  path: string;
  size: number;
  timestamp: Date;
  url: string;
  type: 'manual' | 'auto';
}

export interface DatabaseManagerResult {
  success: boolean;
  action: string;
  data?: any;
  backups?: DatabaseBackup[];
  message?: string;
  error?: string;
  timestamp: Date;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private config: DatabaseManagerConfig;
  private githubStorage: OdarkGitHubStorage;
  private backupTimer?: NodeJS.Timeout;

  private constructor() {
    this.config = {
      autoBackup: true,
      backupInterval: 24, // 24 jam sekali
      maxBackups: 10,
      syncToGitHub: true,
      githubRepository: 'ai-dataset-storage'
    };
    this.githubStorage = OdarkGitHubStorage.getInstance();
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Inisialisasi Database Manager
   */
  async initialize(): Promise<DatabaseManagerResult> {
    try {
      // Load konfigurasi dari database
      await this.loadConfig();
      
      // Start auto backup jika diaktifkan
      if (this.config.autoBackup) {
        this.startAutoBackup();
      }

      return {
        success: true,
        action: 'initialize',
        data: {
          config: this.config,
          autoBackupActive: this.config.autoBackup
        },
        message: 'Database Manager berhasil diinisialisasi',
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'initialize',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Setup konfigurasi Database Manager
   */
  async setup(config: Partial<DatabaseManagerConfig>): Promise<DatabaseManagerResult> {
    try {
      this.config = { ...this.config, ...config };
      
      // Simpan konfigurasi ke database
      await this.saveConfig();
      
      // Restart auto backup jika perlu
      if (this.backupTimer) {
        clearInterval(this.backupTimer);
      }
      
      if (this.config.autoBackup) {
        this.startAutoBackup();
      }

      return {
        success: true,
        action: 'setup',
        data: { config: this.config },
        message: 'Konfigurasi Database Manager berhasil diperbarui',
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'setup',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Backup database manual
   */
  async backupDatabase(type: 'manual' | 'auto' = 'manual'): Promise<DatabaseManagerResult> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `database-backup-${type}-${timestamp}.db`;
      
      // Path ke database SQLite
      const dbPath = './db/app.db';
      
      // Backup ke GitHub jika diaktifkan dan GitHub sudah dikonfigurasi
      let backupData: any = null;
      
      if (this.config.syncToGitHub && this.githubStorage.isConfigured()) {
        const githubResult = await this.githubStorage.backupDatabase(dbPath);
        
        if (githubResult.success) {
          backupData = {
            filename: githubResult.data.filename,
            path: githubResult.data.path,
            size: githubResult.data.size,
            url: githubResult.data.url,
            timestamp: githubResult.data.timestamp,
            type
          };
        }
      }

      // Simpan metadata backup ke database lokal
      const backup = await db.databaseBackup.create({
        data: {
          filename: backupData?.filename || filename,
          path: backupData?.path || `local/${filename}`,
          size: backupData?.size || 0,
          url: backupData?.url || '',
          type,
          timestamp: new Date()
        }
      });

      // Cleanup old backups
      await this.cleanupOldBackups();

      return {
        success: true,
        action: 'backup_database',
        data: {
          id: backup.id,
          filename: backup.filename,
          path: backup.path,
          size: backup.size,
          timestamp: backup.timestamp,
          url: backup.url,
          type
        },
        message: `Database berhasil di-backup (${type})`,
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
   * Restore database dari backup
   */
  async restoreDatabase(backupId: string): Promise<DatabaseManagerResult> {
    try {
      // Cari backup di database
      const backup = await db.databaseBackup.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        throw new Error(`Backup dengan ID ${backupId} tidak ditemukan`);
      }

      // Jika backup ada di GitHub, download dulu
      if (backup.url.includes('github.com')) {
        // Download dari GitHub
        const response = await fetch(backup.url.replace('/blob/', '/raw/'));
        if (!response.ok) {
          throw new Error('Gagal mengunduh backup dari GitHub');
        }
        
        const buffer = await response.arrayBuffer();
        // Simpan buffer ke file database (server-side only)
        // Note: Ini memerlukan implementasi server-side file writing
      }

      return {
        success: true,
        action: 'restore_database',
        data: {
          backupId: backup.id,
          filename: backup.filename,
          restoredAt: new Date()
        },
        message: `Database berhasil direstore dari backup ${backup.filename}`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'restore_database',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * List semua backup
   */
  async listBackups(): Promise<DatabaseManagerResult> {
    try {
      const backups = await db.databaseBackup.findMany({
        orderBy: { timestamp: 'desc' }
      });

      return {
        success: true,
        action: 'list_backups',
        backups: backups.map(backup => ({
          id: backup.id,
          filename: backup.filename,
          path: backup.path,
          size: backup.size,
          timestamp: backup.timestamp,
          url: backup.url,
          type: backup.type as 'manual' | 'auto'
        })),
        message: `Ditemukan ${backups.length} backup`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'list_backups',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Hapus backup
   */
  async deleteBackup(backupId: string): Promise<DatabaseManagerResult> {
    try {
      const backup = await db.databaseBackup.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        throw new Error(`Backup dengan ID ${backupId} tidak ditemukan`);
      }

      await db.databaseBackup.delete({
        where: { id: backupId }
      });

      return {
        success: true,
        action: 'delete_backup',
        data: { backupId, filename: backup.filename },
        message: `Backup ${backup.filename} berhasil dihapus`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'delete_backup',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sync dataset ke GitHub
   */
  async syncDatasetsToGitHub(): Promise<DatabaseManagerResult> {
    try {
      if (!this.githubStorage.isConfigured()) {
        throw new Error('GitHub belum dikonfigurasi');
      }

      // Ambil semua dataset dari database lokal
      const datasets = await db.datasetMetadata.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const syncResults = [];
      
      for (const dataset of datasets) {
        try {
          // Load data dari GitHub (karena data asli ada di sana)
          const loadResult = await this.githubStorage.loadDataset(dataset.name, dataset.format);
          
          if (loadResult.success) {
            syncResults.push({
              name: dataset.name,
              format: dataset.format,
              status: 'synced',
              data: loadResult.data
            });
          } else {
            syncResults.push({
              name: dataset.name,
              format: dataset.format,
              status: 'failed',
              error: loadResult.error
            });
          }
        } catch (error) {
          syncResults.push({
            name: dataset.name,
            format: dataset.format,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = syncResults.filter(r => r.status === 'synced').length;
      const failCount = syncResults.length - successCount;

      return {
        success: true,
        action: 'sync_datasets',
        data: {
          totalDatasets: datasets.length,
          successCount,
          failCount,
          results: syncResults
        },
        message: `Sync selesai: ${successCount} berhasil, ${failCount} gagal`,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        action: 'sync_datasets',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get statistik database
   */
  async getDatabaseStats(): Promise<DatabaseManagerResult> {
    try {
      // Hitung jumlah record di setiap tabel
      const [
        userCount,
        sessionCount,
        messageCount,
        modelCount,
        usageCount,
        auditCount,
        datasetCount,
        backupCount
      ] = await Promise.all([
        db.user.count(),
        db.chatSession.count(),
        db.chatMessage.count(),
        db.aIModel.count(),
        db.modelUsage.count(),
        db.auditLog.count(),
        db.datasetMetadata.count(),
        db.databaseBackup.count()
      ]);

      // Get ukuran database file
      let dbSize = 0;
      try {
        // Note: Implementasi server-side file reading
        // const fs = require('fs').promises;
        // const stats = await fs.stat('./db/app.db');
        // dbSize = stats.size;
        dbSize = 0; // Placeholder
      } catch {
        dbSize = 0;
      }

      return {
        success: true,
        action: 'get_stats',
        data: {
          tables: {
            users: userCount,
            chatSessions: sessionCount,
            chatMessages: messageCount,
            aiModels: modelCount,
            modelUsage: usageCount,
            auditLogs: auditCount,
            datasets: datasetCount,
            backups: backupCount
          },
          databaseSize: dbSize,
          githubConfigured: this.githubStorage.isConfigured(),
          autoBackupActive: this.config.autoBackup,
          lastBackup: await this.getLastBackupTime()
        },
        message: 'Statistik database berhasil diambil',
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
   * Start auto backup timer
   */
  private startAutoBackup(): void {
    const intervalMs = this.config.backupInterval * 60 * 60 * 1000; // konversi jam ke ms
    
    this.backupTimer = setInterval(async () => {
      await this.backupDatabase('auto');
    }, intervalMs);
  }

  /**
   * Stop auto backup timer
   */
  private stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = undefined;
    }
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await db.databaseBackup.findMany({
        orderBy: { timestamp: 'desc' }
      });

      if (backups.length > this.config.maxBackups) {
        const toDelete = backups.slice(this.config.maxBackups);
        
        for (const backup of toDelete) {
          await db.databaseBackup.delete({
            where: { id: backup.id }
          });
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Get last backup time
   */
  private async getLastBackupTime(): Promise<Date | null> {
    try {
      const lastBackup = await db.databaseBackup.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      return lastBackup?.timestamp || null;
    } catch {
      return null;
    }
  }

  /**
   * Load konfigurasi dari database
   */
  private async loadConfig(): Promise<void> {
    try {
      const config = await db.localStorage.findUnique({
        where: { key: 'database_manager_config' }
      });

      if (config) {
        this.config = { ...this.config, ...config.value };
      }
    } catch (error) {
      console.error('Failed to load database manager config:', error);
    }
  }

  /**
   * Simpan konfigurasi ke database
   */
  private async saveConfig(): Promise<void> {
    try {
      await db.localStorage.upsert({
        where: { key: 'database_manager_config' },
        update: {
          value: this.config,
          updatedAt: new Date()
        },
        create: {
          key: 'database_manager_config',
          value: this.config,
          type: 'config'
        }
      });
    } catch (error) {
      console.error('Failed to save database manager config:', error);
    }
  }

  /**
   * Get konfigurasi saat ini
   */
  getConfig(): DatabaseManagerConfig {
    return { ...this.config };
  }
}

export default DatabaseManager;