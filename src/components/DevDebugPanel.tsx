'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ParseDebugData {
  markdown?: string;
  data?: {
    items: Array<{ name: string; price: number; quantity: number }>;
    subtotal: number;
    tax: number;
    total: number;
  };
  error?: string;
  status?: number;
  timing?: {
    totalMs: number;
  };
}

interface DevDebugPanelProps {
  debugData: ParseDebugData | null;
}

export function DevDebugPanel({ debugData }: DevDebugPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'json' | 'markdown'>('json');
  const [isMinimized, setIsMinimized] = useState(false);

  // Check localStorage for dev mode preference
  useEffect(() => {
    const devMode = localStorage.getItem('fairshare-dev-mode');
    if (devMode === 'true') {
      setIsVisible(true);
    }
  }, []);

  // Keyboard shortcut: Ctrl+Shift+D to toggle
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      setIsVisible(prev => {
        const newValue = !prev;
        localStorage.setItem('fairshare-dev-mode', String(newValue));
        return newValue;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isVisible) {
    return null;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-lg w-full">
      <Card className="bg-zinc-950 border-amber-500/50 shadow-xl shadow-amber-500/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-amber-500/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-mono text-amber-400">DEV MODE</span>
            <span className="text-xs text-zinc-500">(Ctrl+Shift+D to toggle)</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
              className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
            >
              {isMinimized ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                localStorage.setItem('fairshare-dev-mode', 'false');
              }}
              className="h-6 w-6 p-0 text-zinc-400 hover:text-red-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="p-4">
            {!debugData ? (
              <div className="text-center py-8 text-zinc-500">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">Upload a document to see parse results</p>
              </div>
            ) : (
              <>
                {/* Status indicator */}
                {debugData.error && (
                  <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/30">
                    <p className="text-xs text-red-400 font-mono">
                      Error {debugData.status}: {debugData.error}
                    </p>
                  </div>
                )}

                {debugData.timing && (
                  <div className="mb-3 text-xs text-zinc-500">
                    Parse time: <span className="text-amber-400">{debugData.timing.totalMs}ms</span>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 mb-3">
                  <button
                    onClick={() => setActiveTab('json')}
                    className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                      activeTab === 'json'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => setActiveTab('markdown')}
                    className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                      activeTab === 'markdown'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Markdown
                  </button>
                </div>

                {/* Content area */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(
                      activeTab === 'json'
                        ? JSON.stringify(debugData.data, null, 2)
                        : debugData.markdown || ''
                    )}
                    className="absolute top-2 right-2 h-6 px-2 text-xs text-zinc-500 hover:text-white"
                  >
                    Copy
                  </Button>
                  <pre className="bg-zinc-900 rounded p-3 text-xs font-mono overflow-auto max-h-64 text-zinc-300">
                    {activeTab === 'json' ? (
                      debugData.data ? (
                        JSON.stringify(debugData.data, null, 2)
                      ) : (
                        <span className="text-zinc-500">No JSON data available</span>
                      )
                    ) : (
                      debugData.markdown || <span className="text-zinc-500">No markdown available</span>
                    )}
                  </pre>
                </div>

                {/* Quick stats */}
                {debugData.data && (
                  <div className="mt-3 flex gap-4 text-xs text-zinc-500">
                    <span>Items: <span className="text-emerald-400">{debugData.data.items.length}</span></span>
                    <span>Subtotal: <span className="text-emerald-400">${debugData.data.subtotal.toFixed(2)}</span></span>
                    <span>Tax: <span className="text-emerald-400">${debugData.data.tax.toFixed(2)}</span></span>
                    <span>Total: <span className="text-emerald-400">${debugData.data.total.toFixed(2)}</span></span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}


