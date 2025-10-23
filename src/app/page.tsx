'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Zap, Shield, Database, Cpu, Trash2, Settings, Activity, Terminal, HardDrive, Stethoscope, AlertTriangle, CheckCircle, XCircle, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Omit<Message, 'timestamp'> = {
  id: '1',
  role: 'assistant',
  content: 'Saya adalah ODARK, AI asisten internal Z.ai. Siap membantu Anda dengan operasional sistem. Ada yang bisa saya bantu?'
};

export default function ODARKChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [showInternalDashboard, setShowInternalDashboard] = useState(false);
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);
  const [internalStats, setInternalStats] = useState<any>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const formatTime = (date: Date): string => {
    try {
      return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '--:--';
    }
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize on hydration
    setIsHydrated(true);
    setMessages([{ ...INITIAL_MESSAGE, timestamp: new Date() }]);
    // Initialize database and session
    initializeDatabase();
    initializeSession();
    // Initialize internal systems
    initializeInternalSystems();
  }, []);

  const initializeDatabase = async () => {
    try {
      await fetch('/api/internal/init-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('Database initialized');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  };

  const initializeInternalSystems = async () => {
    try {
      const response = await fetch('/api/internal/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        console.log('Internal systems initialized');
      }
    } catch (error) {
      console.error('Failed to initialize internal systems:', error);
    }
  };

  const fetchInternalStats = async () => {
    try {
      const [modelsResponse, storageResponse, shellResponse] = await Promise.all([
        fetch('/api/internal/models'),
        fetch('/api/internal/storage'),
        fetch('/api/internal/shell?action=stats')
      ]);

      const models = await modelsResponse.json();
      const storage = await storageResponse.json();
      const shell = await shellResponse.json();

      setInternalStats({
        models: models.success ? models.models : [],
        storage: storage.success ? storage.storage : null,
        shell: shell.success ? shell.stats : null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to fetch internal stats:', error);
    }
  };

  const toggleInternalDashboard = () => {
    setShowInternalDashboard(!showInternalDashboard);
    if (!showInternalDashboard) {
      fetchInternalStats();
    }
  };

  const runDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    setAiAnalysis('');
    
    try {
      const response = await fetch('/api/internal/diagnostic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'run_diagnostic',
          sessionId
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setDiagnosticResults(data.diagnostic);
        
        // Automatically get AI analysis
        await getAIAnalysis(data.diagnostic);
      } else {
        console.error('Diagnostic failed:', data.error);
      }
    } catch (error) {
      console.error('Error running diagnostic:', error);
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const getAIAnalysis = async (diagnostic: any) => {
    try {
      const response = await fetch('/api/internal/diagnostic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ai_diagnostic',
          diagnostic,
          sessionId
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setAiAnalysis(data.aiAnalysis);
      }
    } catch (error) {
      console.error('Error getting AI analysis:', error);
    }
  };

  const executeAutoFix = async (fixAction: string) => {
    try {
      const response = await fetch('/api/internal/diagnostic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'auto_fix',
          fixAction,
          sessionId
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Re-run diagnostic to see the results
        await runDiagnostic();
      } else {
        console.error('Auto-fix failed:', data.error);
      }
    } catch (error) {
      console.error('Error executing auto-fix:', error);
    }
  };

  const toggleDiagnosticPanel = () => {
    setShowDiagnosticPanel(!showDiagnosticPanel);
    if (!showDiagnosticPanel && !diagnosticResults) {
      runDiagnostic();
    }
  };

  const initializeSession = async () => {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!sessionId) return;
    
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          role,
          content,
        }),
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sesi telah direset. Saya adalah ODARK, AI asisten internal Z.ai. Ada yang bisa saya bantu?',
        timestamp: new Date()
      }
    ]);
    initializeSession();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message to database
    await saveMessage('user', input.trim());

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.trim(),
          conversation: messages.map(m => ({ role: m.role, content: m.content })),
          sessionId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Save assistant message to database
      await saveMessage('assistant', data.response);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Maaf, terjadi kesalahan sistem. Saya akan segera memperbaikinya.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col">
      {/* Header */}
      <header className="border-b-4 border-yellow-400 bg-black backdrop-blur-sm sticky top-0 z-50 shadow-lg shadow-yellow-800/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="relative"
              >
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center overflow-hidden">
                  <img 
                    src="/odark-logo.png" 
                    alt="ODARK Logo" 
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-yellow-400">ODARK</h1>
                <p className="text-xs text-yellow-600">AI Asisten Operasional Z.ai</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => window.location.href = '/github-config'}
                variant="outline"
                size="sm"
                className="border-2 border-yellow-400 text-white hover:bg-yellow-400 hover:text-black transition-all duration-300"
              >
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button
                onClick={toggleDiagnosticPanel}
                variant="outline"
                size="sm"
                className="border-2 border-yellow-400 text-white hover:bg-yellow-400 hover:text-black transition-all duration-300"
              >
                <Stethoscope className="w-4 h-4 mr-2" />
                Diagnostic
              </Button>
              <Button
                onClick={toggleInternalDashboard}
                variant="outline"
                size="sm"
                className="border-2 border-yellow-400 text-white hover:bg-yellow-400 hover:text-black transition-all duration-300"
              >
                <Settings className="w-4 h-4 mr-2" />
                Internal
              </Button>
              <Button
                onClick={clearChat}
                variant="outline"
                size="sm"
                className="border-2 border-yellow-400 text-white hover:bg-yellow-400 hover:text-black transition-all duration-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <div className="flex items-center space-x-2 text-xs text-white">
                <Shield className="w-4 h-4" />
                <span>Terenkripsi</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-white">
                <Database className="w-4 h-4" />
                <span>Internal</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-white">
                <Cpu className="w-4 h-4" />
                <span>Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Diagnostic Panel */}
      {showDiagnosticPanel && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-b-4 border-yellow-400 bg-black backdrop-blur-sm shadow-lg shadow-yellow-800/20"
        >
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-yellow-400 flex items-center">
                <Stethoscope className="w-5 h-5 mr-2" />
                ODARK System Diagnostic
              </h2>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={runDiagnostic}
                  disabled={isRunningDiagnostic}
                  variant="outline"
                  size="sm"
                  className="border-yellow-800/30 text-yellow-600 hover:bg-yellow-900/20"
                >
                  {isRunningDiagnostic ? (
                    <>
                      <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mr-2" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4 mr-2" />
                      Run Diagnostic
                    </>
                  )}
                </Button>
              </div>
            </div>

            {diagnosticResults && (
              <div className="space-y-4">
                {/* Overall Status */}
                <Card className={`p-4 border ${
                  diagnosticResults.overall === 'healthy' 
                    ? 'border-green-500/30 bg-green-500/5' 
                    : diagnosticResults.overall === 'warning'
                    ? 'border-yellow-500/30 bg-yellow-500/5'
                    : diagnosticResults.overall === 'error'
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {diagnosticResults.overall === 'healthy' && <CheckCircle className="w-5 h-5 text-green-400 mr-2" />}
                      {diagnosticResults.overall === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2" />}
                      {diagnosticResults.overall === 'error' && <XCircle className="w-5 h-5 text-orange-400 mr-2" />}
                      {diagnosticResults.overall === 'critical' && <XCircle className="w-5 h-5 text-red-400 mr-2" />}
                      <span className="font-semibold text-yellow-400">
                        System Status: {diagnosticResults.overall.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-yellow-600">
                      {diagnosticResults.summary.total} checks • {diagnosticResults.summary.healthy} healthy • {diagnosticResults.summary.warning} warnings • {diagnosticResults.summary.error} errors • {diagnosticResults.summary.critical} critical
                    </div>
                  </div>
                </Card>

                {/* Diagnostic Results */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {diagnosticResults.results.map((result: any, index: number) => (
                    <Card key={index} className={`p-4 border ${
                      result.status === 'healthy' 
                        ? 'border-green-500/20 bg-green-500/5' 
                        : result.status === 'warning'
                        ? 'border-yellow-500/20 bg-yellow-500/5'
                        : result.status === 'error'
                        ? 'border-orange-500/20 bg-orange-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-semibold text-yellow-400">{result.category}</h4>
                        <div className="flex items-center">
                          {result.status === 'healthy' && <CheckCircle className="w-4 h-4 text-green-400" />}
                          {result.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                          {result.status === 'error' && <XCircle className="w-4 h-4 text-orange-400" />}
                          {result.status === 'critical' && <XCircle className="w-4 h-4 text-red-400" />}
                        </div>
                      </div>
                      <p className="text-xs text-yellow-300 mb-2">{result.message}</p>
                      
                      {result.suggestions && result.suggestions.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-yellow-600 mb-1">Suggestions:</p>
                          <ul className="text-xs text-yellow-500 space-y-1">
                            {result.suggestions.map((suggestion: string, i: number) => (
                              <li key={i} className="flex items-center">
                                <span className="w-1 h-1 bg-yellow-500 rounded-full mr-2" />
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {result.canAutoFix && (
                        <Button
                          onClick={() => executeAutoFix(result.fixAction)}
                          variant="outline"
                          size="sm"
                          className="border-yellow-700/30 text-yellow-600 hover:bg-yellow-900/20 text-xs"
                        >
                          Auto Fix
                        </Button>
                      )}
                    </Card>
                  ))}
                </div>

                {/* AI Analysis */}
                {aiAnalysis && (
                  <Card className="p-4 border border-yellow-800/30 bg-black/50">
                    <h4 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center">
                      <Bot className="w-4 h-4 mr-2" />
                      ODARK AI Analysis
                    </h4>
                    <div className="text-xs text-yellow-300 whitespace-pre-wrap">
                      {aiAnalysis}
                    </div>
                  </Card>
                )}

                <div className="text-xs text-yellow-700">
                  Last diagnostic: {new Date(diagnosticResults.timestamp).toLocaleString('id-ID')}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Internal Dashboard */}
      {showInternalDashboard && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-b border-yellow-900/30 bg-black/80 backdrop-blur-sm"
        >
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-yellow-400 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Internal Systems Dashboard
              </h2>
              <Button
                onClick={fetchInternalStats}
                variant="outline"
                size="sm"
                className="border-yellow-800/30 text-yellow-600 hover:bg-yellow-900/20"
              >
                Refresh
              </Button>
            </div>

            {internalStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* AI Models Status */}
                <Card className="p-4 border border-yellow-800/30 bg-black/50">
                  <div className="flex items-center mb-3">
                    <Cpu className="w-4 h-4 mr-2 text-yellow-400" />
                    <h3 className="text-sm font-semibold text-yellow-400">AI Models</h3>
                  </div>
                  <div className="space-y-2">
                    {internalStats.models.map((model: any) => (
                      <div key={model.id} className="flex justify-between items-center text-xs">
                        <span className="text-yellow-600">{model.name}</span>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded ${
                            model.status === 'active' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {model.status}
                          </span>
                          <span className="text-yellow-700">{model.usageCount || 0} uses</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Storage Status */}
                <Card className="p-4 border border-yellow-800/30 bg-black/50">
                  <div className="flex items-center mb-3">
                    <HardDrive className="w-4 h-4 mr-2 text-yellow-400" />
                    <h3 className="text-sm font-semibold text-yellow-400">Local Storage</h3>
                  </div>
                  {internalStats.storage ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-yellow-600">Total Entries</span>
                        <span className="text-yellow-400">{internalStats.storage.totalEntries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-600">Expired</span>
                        <span className="text-yellow-400">{internalStats.storage.expiredEntries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-600">Storage Path</span>
                        <span className="text-yellow-400 text-xs">chat.zai</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-yellow-600">Storage status unavailable</p>
                  )}
                </Card>

                {/* Shell & Audit Status */}
                <Card className="p-4 border border-yellow-800/30 bg-black/50">
                  <div className="flex items-center mb-3">
                    <Terminal className="w-4 h-4 mr-2 text-yellow-400" />
                    <h3 className="text-sm font-semibold text-yellow-400">Shell & Audit</h3>
                  </div>
                  {internalStats.shell ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-yellow-600">Total Commands</span>
                        <span className="text-yellow-400">{internalStats.shell.commands.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-600">Pending</span>
                        <span className="text-yellow-400">{internalStats.shell.commands.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-600">Success Rate</span>
                        <span className="text-yellow-400">{internalStats.shell.systemHealth.executionRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-yellow-600">Shell status unavailable</p>
                  )}
                </Card>
              </div>
            )}

            <div className="mt-4 text-xs text-yellow-700">
              Last updated: {internalStats?.timestamp ? new Date(internalStats.timestamp).toLocaleString('id-ID') : 'Never'}
            </div>
          </div>
        </motion.div>
      )}

      {/* Chat Area */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-200px)]">
          <div className="space-y-4 pb-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ 
                    duration: 0.4,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user' 
                          ? 'bg-yellow-500 text-black' 
                          : 'bg-yellow-900/30 border border-yellow-700/50'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: message.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className={`w-full`}
                    >
                      <Card className={`p-3 border transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 ${
                        message.role === 'user' 
                          ? 'bg-yellow-500/10 border-yellow-600/30 text-yellow-300' 
                          : 'bg-black/50 border-yellow-800/30 text-yellow-400'
                      }`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <p className="text-xs text-yellow-700 mt-2">
                          {isHydrated ? formatTime(message.timestamp) : '--:--'}
                        </p>
                      </Card>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex justify-start"
              >
                <div className="flex items-start space-x-3 max-w-[80%]">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="w-8 h-8 rounded-full bg-yellow-900/30 border border-yellow-700/50 flex items-center justify-center"
                  >
                    <Bot className="w-4 h-4" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  >
                    <Card className="p-3 border bg-black/50 border-yellow-800/30 text-yellow-400">
                      <div className="flex items-center space-x-2">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                          className="w-2 h-2 bg-yellow-500 rounded-full" 
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.4, delay: 0.2, ease: "easeInOut" }}
                          className="w-2 h-2 bg-yellow-500 rounded-full" 
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.4, delay: 0.4, ease: "easeInOut" }}
                          className="w-2 h-2 bg-yellow-500 rounded-full" 
                        />
                      </div>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Input Area */}
      <footer className="border-t border-yellow-900/30 bg-black/90 backdrop-blur-sm sticky bottom-0">
        <div className="container mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            <motion.div 
              className="flex-1 relative"
              whileFocus={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ketik perintah atau pertanyaan..."
                className="bg-black/50 border-yellow-800/30 text-yellow-400 placeholder-yellow-700 focus:border-yellow-600 focus:ring-yellow-600/20 transition-all duration-300"
                disabled={isLoading}
              />
              {input && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  <kbd className="px-2 py-1 text-xs bg-yellow-900/20 border border-yellow-700/30 rounded text-yellow-600">
                    Enter
                  </kbd>
                </motion.div>
              )}
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-6 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </Button>
            </motion.div>
          </form>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-yellow-700">
              ODARK menjaga privasi dan keamanan data Anda
            </p>
            <p className="text-xs text-yellow-700">
              Sistem Operasional v1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
