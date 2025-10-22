'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Github, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Link, 
  Settings, 
  Database,
  FolderOpen,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react'

interface GitHubStatus {
  isConfigured: boolean
  username: string
  repository: string
  lastConnected?: string
  connectionTest?: boolean
  repositoryInfo?: any
}

interface RepositoryInfo {
  name: string
  fullName: string
  description: string
  stars: number
  forks: number
  url: string
  createdAt: string
}

export default function GitHubConfigPage() {
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [repository, setRepository] = useState('ai-dataset-storage')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<GitHubStatus | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [repositories, setRepositories] = useState<RepositoryInfo[]>([])

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/github/status')
      const result = await response.json()
      
      if (result.success) {
        setStatus(result.data)
        if (result.data.repositoryInfo) {
          setRepository(result.data.repositoryInfo.name)
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal memeriksa status GitHub' })
    } finally {
      setLoading(false)
    }
  }

  const connectToGitHub = async () => {
    if (!token.trim()) {
      setMessage({ type: 'error', text: 'Token GitHub diperlukan' })
      return
    }

    try {
      setLoading(true)
      setMessage(null)

      const response = await fetch('/api/github/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, repository })
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        setToken('')
        await checkStatus()
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal terhubung ke GitHub' })
    } finally {
      setLoading(false)
    }
  }

  const disconnectFromGitHub = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/github/disconnect', { method: 'POST' })
      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        setStatus(null)
        setRepositories([])
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal disconnect dari GitHub' })
    } finally {
      setLoading(false)
    }
  }

  const listRepositories = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/github/repositories')
      const result = await response.json()

      if (result.success) {
        setRepositories(result.repositories || [])
        setMessage({ type: 'success', text: result.message })
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal mengambil daftar repository' })
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/github/test')
      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        await checkStatus()
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal testing koneksi' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Github className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">GitHub Integration</h1>
          <p className="text-muted-foreground">Hubungkan akun GitHub Anda untuk penyimpanan dataset dan database</p>
        </div>
      </div>

      {message && (
        <Alert className={`mb-6 ${
          message.type === 'success' ? 'border-green-200 bg-green-50' :
          message.type === 'error' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }`}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="status" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="connect">Koneksi</TabsTrigger>
          <TabsTrigger value="repositories">Repository</TabsTrigger>
          <TabsTrigger value="manage">Kelola</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Status Koneksi GitHub
              </CardTitle>
              <CardDescription>
                Status koneksi akun GitHub Anda dengan sistem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status ? (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {status.isConfigured && status.connectionTest ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">Akun: {status.username}</p>
                        <p className="text-sm text-muted-foreground">
                          Repository: {status.repository}
                        </p>
                      </div>
                    </div>
                    <Badge variant={status.isConfigured ? "default" : "secondary"}>
                      {status.isConfigured ? "Terhubung" : "Tidak Terhubung"}
                    </Badge>
                  </div>

                  {status.lastConnected && (
                    <div className="text-sm text-muted-foreground">
                      Terakhir terhubung: {new Date(status.lastConnected).toLocaleString('id-ID')}
                    </div>
                  )}

                  {status.repositoryInfo && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Informasi Repository</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Nama</Label>
                            <p className="font-medium">{status.repositoryInfo.name}</p>
                          </div>
                          <div>
                            <Label>Stars</Label>
                            <p className="font-medium">⭐ {status.repositoryInfo.stars}</p>
                          </div>
                          <div>
                            <Label>Forks</Label>
                            <p className="font-medium">🍴 {status.repositoryInfo.forks}</p>
                          </div>
                          <div>
                            <Label>Ukuran</Label>
                            <p className="font-medium">{status.repositoryInfo.size} KB</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Label>Deskripsi</Label>
                          <p className="text-sm text-muted-foreground">
                            {status.repositoryInfo.description || 'Tidak ada deskripsi'}
                          </p>
                        </div>
                        <div className="mt-4">
                          <Button variant="outline" asChild>
                            <a 
                              href={status.repositoryInfo.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              <Link className="h-4 w-4" />
                              Buka di GitHub
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={testConnection} disabled={loading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Test Koneksi
                    </Button>
                    <Button variant="outline" onClick={checkStatus} disabled={loading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Refresh Status
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Github className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Belum terhubung ke GitHub</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Silakan hubungkan akun GitHub Anda pada tab Koneksi
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connect">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Hubungkan ke GitHub
              </CardTitle>
              <CardDescription>
                Masukkan token GitHub untuk menghubungkan akun odarkserver Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">GitHub Personal Access Token</Label>
                <div className="relative">
                  <Input
                    id="token"
                    type={showToken ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Buat token di{' '}
                  <a 
                    href="https://github.com/settings/tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GitHub Settings → Developer settings → Personal access tokens
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repository">Nama Repository</Label>
                <Input
                  id="repository"
                  placeholder="ai-dataset-storage"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Repository akan dibuat otomatis jika belum ada
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">📋 Cara Mendapatkan Token:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Buka{' '}
                    <a 
                      href="https://github.com/settings/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      GitHub Token Settings
                    </a>
                  </li>
                  <li>Klik "Generate new token (classic)"</li>
                  <li>Beri nama token (contoh: "ODARK AI System")</li>
                  <li>Pilih expiration time</li>
                  <li>Beri checklist: <code>repo</code>, <code>user</code>, <code>admin:repo_hook</code></li>
                  <li>Klik "Generate token"</li>
                  <li>Copy token yang dihasilkan</li>
                </ol>
              </div>

              <Button 
                onClick={connectToGitHub} 
                disabled={loading || !token.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Menghubungkan...
                  </>
                ) : (
                  <>
                    <Github className="h-4 w-4 mr-2" />
                    Hubungkan ke GitHub
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repositories">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Daftar Repository
              </CardTitle>
              <CardDescription>
                Daftar repository di akun GitHub Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button onClick={listRepositories} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {repositories.length > 0 ? (
                <div className="space-y-3">
                  {repositories.map((repo) => (
                    <Card key={repo.name}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{repo.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {repo.description || 'Tidak ada deskripsi'}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>⭐ {repo.stars}</span>
                              <span>🍴 {repo.forks}</span>
                              <span>Dibuat: {new Date(repo.createdAt).toLocaleDateString('id-ID')}</span>
                            </div>
                          </div>
                          <Button variant="outline" asChild>
                            <a href={repo.url} target="_blank" rel="noopener noreferrer">
                              <Link className="h-4 w-4 mr-2" />
                              Buka
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {status?.isConfigured ? 'Belum ada data repository' : 'Hubungkan GitHub terlebih dahulu'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Kelola Koneksi
              </CardTitle>
              <CardDescription>
                Kelola koneksi GitHub Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status?.isConfigured ? (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Anda terhubung dengan akun <strong>{status.username}</strong> 
                      ke repository <strong>{status.repository}</strong>
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-4">
                    <Button onClick={testConnection} disabled={loading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Test Koneksi
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={disconnectFromGitHub}
                      disabled={loading}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Belum terhubung ke GitHub</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Hubungkan akun GitHub Anda pada tab Koneksi
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}