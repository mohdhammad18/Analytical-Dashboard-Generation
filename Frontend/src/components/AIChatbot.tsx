import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Sparkles, BarChart2, LayoutGrid, Table, BrainCircuit, X, Plus, MessageSquare, Trash2, History, Copy, Share2, Check, Square, CornerUpLeft } from 'lucide-react';
import { ChartConfig } from './DynamicChart';
import { DashboardConfig } from './DashboardView';
import { cn } from '../lib/utils';
import { useTheme } from './ThemeProvider';
import { ChartContext } from './Layout';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartConfig?: ChartConfig;
  tableData?: Record<string, any>[];
  dashboardConfig?: DashboardConfig;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface AIChatbotProps {
  chartContexts: ChartContext[];
  onRemoveChartContext: (id: string) => void;
  onAddChartContext: (ctx: ChartContext) => void;
  onWorkspaceChart?: (config: ChartConfig) => void;
  onWorkspaceDashboard?: (config: DashboardConfig) => void;
  onClose?: () => void;
}

function buildContextBlock(contexts: ChartContext[]): string {
  if (contexts.length === 0) return '';
  const blocks = contexts.map((ctx) => {
    if (ctx.contextType === 'chart') {
      const rows = ctx.config.data
        .map((row) => Object.entries(row).map(([k, v]) => `${k}=${v}`).join(', '))
        .join(' | ');
      return `[Chart: "${ctx.title}"]\nData: ${rows}\nSeries: ${ctx.config.series.map(s => s.name).join(', ')}`;
    }
    if (ctx.contextType === 'table') {
      const header = ctx.tableColumns.join(' | ');
      const rows = ctx.tableData
        .slice(0, 20)
        .map((row) => ctx.tableColumns.map((col) => String(row[col] ?? '')).join(' | '))
        .join('\n');
      return `[Table: "${ctx.title}"]\n${header}\n${rows}`;
    }
    if (ctx.contextType === 'kpi') {
      return `[KPI: "${ctx.title}"]\nValue: ${ctx.value} | Trend: ${ctx.trend}`;
    }
    return '';
  });

  // Check if any context has the full dashboard context
  const fullCtx = contexts.find(c => c.fullDashboardContext);
  if (fullCtx?.fullDashboardContext) {
    const d = fullCtx.fullDashboardContext;
    const kpiBlock = d.kpiData ? `[All KPIs]\n${Object.entries(d.kpiData).map(([k, v]) => `${k}: ${v}`).join(' | ')}` : '';
    const tableBlock = d.userData ? `[User Performance Table]\n${d.userData.slice(0, 10).map((u: any) => `${u.user}: ${u.created_count} created`).join(' | ')}` : '';

    return (
      `\n\n--- FULL DASHBOARD CONTEXT ---\n` +
      kpiBlock + `\n\n` +
      tableBlock + `\n\n` +
      `Individual dropped items:\n` +
      blocks.join('\n\n') +
      `\n---\n`
    );
  }

  return (
    `\n\n--- DASHBOARD CONTEXT ---\n` +
    blocks.join('\n\n') +
    `\n---\n`
  );
}

function InlineTable({ data }: { data: Record<string, any>[] }) {
  const { theme } = useTheme();
  if (!data || data.length === 0) return null;
  const columns = Object.keys(data[0]);
  const displayRows = data.slice(0, 20);
  return (
    <div className={cn(
      "mt-2 w-full max-w-full overflow-x-auto rounded-lg border backdrop-blur-md text-xs",
      theme === 'dark' ? "border-white/10 bg-black/20" : "bg-white/50 border-black/5"
    )}>
      <table className={cn("w-full text-left", theme === 'dark' ? "text-white/90" : "text-gray-900")}>
        <thead className={cn("text-[10px] uppercase", theme === 'dark' ? "text-white/40 bg-white/5" : "text-gray-500 bg-black/5")}>
          <tr>
            {columns.map((col) => (
              <th key={col} className={cn("px-3 py-2 whitespace-nowrap font-semibold border-b", theme === 'dark' ? "border-white/10" : "border-black/5")}>{col.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i} className={cn("border-b last:border-none transition-colors", theme === 'dark' ? "border-white/5 hover:bg-white/5" : "border-black/5 hover:bg-black/5")}>
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 whitespace-nowrap">{String(row[col] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 20 && (
        <div className={cn("text-[10px] text-center py-1", theme === 'dark' ? "text-white/30 bg-white/5" : "text-gray-400 bg-black/5")}>
          Showing 20 of {data.length} rows
        </div>
      )}
    </div>
  );
}

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
const BACKEND_URL = rawBackendUrl.replace(/\/$/, '');

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content: 'Hello! I am your AI Data Analyst. Ask me anything about your video conversion metrics, or drag a chart/table here as context.',
};

export function AIChatbot({ chartContexts, onRemoveChartContext, onAddChartContext, onWorkspaceChart, onWorkspaceDashboard, onClose }: AIChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [makeChart, setMakeChart] = useState(false);
  const [makeDashboard, setMakeDashboard] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; role: 'user' | 'assistant'; content: string } | null>(null);
  const dragCounter = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { theme } = useTheme();

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('viralai_chat_session_id');
  });
  const [showHistory, setShowHistory] = useState(false);

  // Resizable width
  const [panelWidth, setPanelWidth] = useState(384);
  const isResizing = useRef(false);

  // Responsive width capping
  useEffect(() => {
    const handleResize = () => {
      const maxWidth = window.innerWidth * 0.8;
      if (panelWidth > maxWidth) {
        setPanelWidth(Math.max(320, maxWidth));
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [panelWidth]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.min(800, Math.max(320, startWidth + delta));
      setPanelWidth(newWidth);
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  useEffect(() => {
    loadSessions();
    if (activeSessionId) {
      loadSessionMessages(activeSessionId);
    }
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('viralai_chat_session_id', activeSessionId);
    } else {
      localStorage.removeItem('viralai_chat_session_id');
    }
  }, [activeSessionId]);

  const loadSessions = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/sessions/`);
      setSessions(data);
    } catch { }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/sessions/${sessionId}/messages`);
      const loaded: Message[] = data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        tableData: m.table_data ?? undefined,
        chartConfig: m.chart_config ?? undefined,
      }));
      setMessages(loaded.length > 0 ? loaded : [GREETING]);
      setActiveSessionId(sessionId);
      setShowHistory(false);
    } catch {
      setActiveSessionId(null);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([GREETING]);
    setShowHistory(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await axios.delete(`${BACKEND_URL}/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) handleNewChat();
    } catch { }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('application/x-dashboard-context')) return;
    dragCounter.current += 1;
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    dragCounter.current = 0;
    const raw = e.dataTransfer.getData('application/x-dashboard-context');
    if (!raw) return;
    try {
      const ctx = JSON.parse(raw) as ChartContext;
      onAddChartContext(ctx);
    } catch { }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    const contextBlock = buildContextBlock(chartContexts);
    const replyPrefix = replyTo
      ? `[Replying to ${replyTo.role === 'user' ? 'your message' : 'AI'}: "${replyTo.content.slice(0, 120)}${replyTo.content.length > 120 ? '…' : ''}"]\n`
      : '';
    const fullText = replyPrefix + input + contextBlock;

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setReplyTo(null);
    setIsTyping(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const history = messages
        .filter((m) => m.id !== 'greeting')
        .map((m) => ({ role: m.role, content: m.content }));

      const { data } = await axios.post(`${BACKEND_URL}/chat`, {
        messages: history,
        text: fullText,
        make_chart: makeChart,
        make_dashboard: makeDashboard,
        session_id: activeSessionId,
      }, { signal: controller.signal });

      if (data.session_id && data.session_id !== activeSessionId) {
        setActiveSessionId(data.session_id);
        loadSessions();
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply ?? 'No response from agent.',
        tableData: data.table_data ?? undefined,
        chartConfig: data.chart_config ?? undefined,
        dashboardConfig: data.dashboard_config ?? undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.chart_config && onWorkspaceChart) {
        onWorkspaceChart(data.chart_config);
      }
      if (data.dashboard_config && onWorkspaceDashboard) {
        onWorkspaceDashboard(data.dashboard_config);
      }
    } catch (err: unknown) {
      if (axios.isCancel(err) || (err instanceof Error && err.name === 'CanceledError')) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⏹ Response cancelled.',
        }]);
        return;
      }
      let errorText = 'Unknown error';
      if (axios.isAxiosError(err)) {
        errorText = err.response?.data?.detail ?? err.message;
      } else if (err instanceof Error) {
        errorText = err.message;
      }
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Failed to reach the AI backend: ${errorText}. Please ensure the server is running.`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const renderHistorySidebar = () => {
    if (!showHistory) return null;
    return (
      <div className={cn(
        "absolute inset-0 z-40 flex flex-col backdrop-blur-3xl border-r shadow-2xl",
        theme === 'dark' 
          ? "bg-[#0a0b14]/95 border-white/5" 
          : "bg-white/95 border-black/5"
      )}>
        <div className={cn(
          "p-4 border-b flex items-center justify-between",
          theme === 'dark' ? "border-white/5" : "border-black/5"
        )}>
          <div className="flex items-center gap-2">
            <History className={cn("w-4 h-4", theme === 'dark' ? "text-white" : "text-gray-900")} />
            <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>Chat History</h3>
          </div>
          <button 
            onClick={() => setShowHistory(false)} 
            className={cn(
              "p-1 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-white/10 text-white/40 hover:text-white" : "hover:bg-black/5 text-gray-400 hover:text-gray-900"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl transition-all",
              theme === 'dark' ? "text-black bg-white hover:bg-white/90" : "text-white bg-gray-900 hover:bg-gray-800"
            )}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 custom-scrollbar">
          {sessions.length === 0 && (
            <p className={cn("text-xs text-center py-8", theme === 'dark' ? "text-white/20" : "text-gray-400")}>No previous chats</p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                activeSessionId === s.id 
                  ? (theme === 'dark' ? "bg-white/10 text-white" : "bg-black/5 text-gray-900 shadow-sm") 
                  : (theme === 'dark' ? "hover:bg-white/5 text-white/40 hover:text-white" : "hover:bg-black/5 text-gray-400 hover:text-gray-900")
              )}
              onClick={() => loadSessionMessages(s.id)}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{s.title}</p>
                <p className="text-[10px] opacity-40">{new Date(s.updated_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                className={cn(
                  "p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                  theme === 'dark' ? "hover:bg-white/10 text-white/40" : "hover:bg-black/10 text-gray-400"
                )}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "relative flex flex-col h-full border-l shrink-0 shadow-2xl z-10 transition-all duration-300 overflow-hidden",
        theme === 'dark' 
          ? "bg-gradient-to-b from-[#1a1c2d] via-[#11131f] to-[#0a0b14] border-white/5" 
          : "bg-[#f8f7f4]/90 backdrop-blur-3xl border-black/5"
      )}
      style={{ width: panelWidth }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/10 active:bg-white transition-colors z-20"
        onMouseDown={handleResizeStart}
      />
      {isDragOver && (
        <div className={cn(
          "absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 backdrop-blur-2xl border-2 border-dashed pointer-events-none transition-all duration-500",
          theme === 'dark' ? "bg-[#0a0b14]/80 border-white/20" : "bg-white/80 border-black/20"
        )}>
          <div className={cn(
            "p-6 rounded-full border animate-float-slow shadow-lg",
            theme === 'dark' ? "bg-white/10 text-white border-white/20" : "bg-black/5 text-gray-900 border-black/10"
          )}>
            <Bot className="w-12 h-12" />
          </div>
          <div className="text-center px-8">
            <p className={cn("text-lg font-extrabold mb-2 tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>Drop to Analyze</p>
            <p className={cn("text-xs leading-relaxed font-medium", theme === 'dark' ? "text-white/60" : "text-gray-500")}>Let InsightArc analyze this context for you</p>
          </div>
        </div>
      )}

      {renderHistorySidebar()}

      <div className={cn(
        "pl-6 pr-4 py-4 border-b flex items-center justify-between gap-3 backdrop-blur-2xl sticky top-0 z-30 transition-colors",
        theme === 'dark' ? "border-white/5 bg-white/5" : "border-black/5 bg-white/40"
      )}>
        <span 
          className={cn(
            "text-xl font-black tracking-tighter",
            theme === 'dark' 
              ? "bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/60" 
              : "text-gray-900"
          )} 
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          InsightArc
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadSessions(); }}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              showHistory 
                ? (theme === 'dark' ? "text-white bg-white/10 shadow-inner" : "text-gray-900 bg-black/5 shadow-inner")
                : (theme === 'dark' ? "text-white/40 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-900 hover:bg-black/5")
            )}
            title="Chat history"
          >
            <History className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={handleNewChat}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              theme === 'dark' ? "text-white/40 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-900 hover:bg-black/5"
            )}
            title="New chat"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                "p-2 rounded-xl transition-all duration-200",
                theme === 'dark' ? "text-white/40 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-900 hover:bg-black/5"
              )}
              title="Close assistant"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8 scroll-smooth custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("group flex gap-4 max-w-[90%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-2xl transition-all duration-300 group-hover:scale-110 border",
              msg.role === 'user' 
                ? (theme === 'dark' ? "bg-white/10 text-white border-white/10" : "bg-indigo-600 text-white border-indigo-500") 
                : (theme === 'dark' ? "bg-black/40 text-white border-white/10" : "bg-white text-gray-900 border-black/5 shadow-sm")
            )}>
              {msg.role === 'user' ? <User className="w-5 h-5 opacity-70" /> : <Bot className="w-5 h-5 opacity-70" />}
            </div>
            <div className={cn(
              "flex flex-col gap-2 min-w-0 flex-1",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "p-4 rounded-[28px] text-sm shadow-2xl backdrop-blur-2xl transition-all duration-500 border",
                msg.role === 'user'
                  ? (theme === 'dark' ? "bg-white/10 border-white/20 text-white rounded-tr-sm" : "bg-indigo-600 border-indigo-500 text-white rounded-tr-sm shadow-indigo-200/50")
                  : (theme === 'dark' ? "bg-black/30 border-white/5 text-white/95 rounded-tl-sm max-w-full overflow-x-auto" : "bg-white border-black/5 text-gray-900 rounded-tl-sm shadow-sm max-w-full overflow-x-auto")
              )}>
                <div className="break-words max-w-full leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        strong: ({ node, ...props }) => <strong className={cn("font-bold", theme === 'dark' ? "text-white" : "text-gray-900", msg.role === 'user' && "text-white")} {...props} />,
                        em: ({ node, ...props }) => <em className="italic" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                        h1: ({ node, ...props }) => <h1 className={cn("text-lg font-bold mb-2 mt-4 first:mt-0 leading-tight border-b pb-1", theme === 'dark' ? "text-white/90 border-white/10" : "text-gray-900 border-black/5", msg.role === 'user' && "text-white border-white/20")} {...props} />,
                        h2: ({ node, ...props }) => <h2 className={cn("text-base font-bold mb-2 mt-3 first:mt-0 leading-tight", theme === 'dark' ? "text-white/80" : "text-gray-800", msg.role === 'user' && "text-white")} {...props} />,
                        h3: ({ node, ...props }) => <h3 className={cn("text-sm font-bold mb-1 mt-2 first:mt-0 leading-tight", theme === 'dark' ? "text-white/70" : "text-gray-700", msg.role === 'user' && "text-white")} {...props} />,
                        pre: ({ node, ...props }) => <pre className={cn("rounded-xl p-4 overflow-x-auto text-xs my-4 border", theme === 'dark' ? "bg-black/40 border-white/10" : "bg-gray-50 border-black/10")} {...props} />,
                        code: ({ node, className, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          return !match ? (
                            <code className={cn("rounded px-1.5 py-0.5 text-[0.85em] font-mono", theme === 'dark' ? "bg-white/10 text-brand" : "bg-black/5 text-indigo-600", msg.role === 'user' && "bg-white/20 text-white")} {...props} />
                          ) : (
                            <code className="block font-mono text-xs whitespace-pre pb-2" {...props} />
                          )
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                </div>
              </div>
              {msg.tableData && msg.tableData.length > 0 && (
                <div className="w-full max-w-full mt-2">
                  <InlineTable data={msg.tableData} />
                </div>
              )}
              {msg.id !== 'greeting' && (
                <div className={cn(
                  "flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-all duration-300",
                  msg.role === 'user' ? "justify-end" : ""
                )}>
                  <button
                    onClick={() => {
                      setReplyTo({ id: msg.id, role: msg.role, content: msg.content });
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full transition-all uppercase tracking-wider",
                      theme === 'dark' ? "text-white/40 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-900 hover:bg-black/5"
                    )}
                  >
                    <CornerUpLeft className="w-3 h-3" />
                    Reply
                  </button>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopiedId(msg.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full transition-all uppercase tracking-wider",
                        theme === 'dark' ? "text-white/40 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-900 hover:bg-black/5"
                      )}
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedId === msg.id ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-4 max-w-[90%] animate-pulse">
            <div className="w-10 h-10 rounded-full bg-black/40 border border-white/5 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white/40" />
            </div>
            <div className="p-4 bg-black/30 border border-white/5 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <div className={cn(
          "mx-6 mb-2 flex items-center justify-between gap-3 px-4 py-3 backdrop-blur-xl border rounded-2xl animate-in slide-in-from-bottom-2 duration-300",
          theme === 'dark' ? "bg-white/5 border-white/10 shadow-emerald-900/10" : "bg-black/5 border-black/5 shadow-inner"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <CornerUpLeft className={cn("w-4 h-4", theme === 'dark' ? "text-white/40" : "text-gray-400")} />
            <div className="min-w-0">
              <p className={cn("text-[10px] font-black uppercase tracking-widest leading-none mb-1", theme === 'dark' ? "text-white/20" : "text-gray-500")}>Replying to {replyTo.role}</p>
              <p className={cn("text-xs truncate italic", theme === 'dark' ? "text-white/60" : "text-gray-600")}>"{replyTo.content}"</p>
            </div>
          </div>
          <button 
            onClick={() => setReplyTo(null)} 
            className={cn(
              "p-1 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-white/10 text-white/40 hover:text-white" : "hover:bg-black/5 text-gray-400 hover:text-gray-900"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={cn(
        "p-6 border-t backdrop-blur-2xl transition-colors",
        theme === 'dark' ? "border-white/5 bg-white/5" : "border-black/5 bg-white/40"
      )}>
        {chartContexts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
            {chartContexts.map((ctx) => (
              <div 
                key={ctx.id} 
                className={cn(
                  "group flex items-center gap-2 px-3 py-1.5 border rounded-full backdrop-blur-md transition-all shadow-sm",
                  theme === 'dark' 
                    ? "bg-white/10 border-white/10 hover:bg-white/20 hover:border-white/30" 
                    : "bg-white border-black/5 hover:bg-gray-50 hover:border-black/10"
                )}
              >
                <div className={cn("shrink-0", theme === 'dark' ? "text-white/60" : "text-gray-500")}>
                  {ctx.contextType === 'chart' ? <BarChart2 className="w-3.5 h-3.5" /> : <Table className="w-3.5 h-3.5" />}
                </div>
                <span className={cn("text-[11px] font-bold truncate max-w-[120px] tracking-tight", theme === 'dark' ? "text-white/80" : "text-gray-700")}>{ctx.title}</span>
                <button 
                  onClick={() => onRemoveChartContext(ctx.id)} 
                  className={cn(
                    "p-0.5 rounded-full transition-colors",
                    theme === 'dark' ? "hover:bg-white/20 text-white/30 hover:text-white" : "hover:bg-black/5 text-gray-400 hover:text-gray-900"
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <form
            onSubmit={handleSend}
            className={cn(
              "relative flex items-center border rounded-2xl transition-all duration-300 shadow-xl overflow-hidden",
              theme === 'dark' 
                ? "bg-white/5 border-white/10 focus-within:border-white/30 focus-within:bg-white/10" 
                : "bg-white border-black/5 shadow-gray-200/20 focus-within:border-indigo-500/30 focus-within:bg-white"
            )}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="How may I help you today?"
              className={cn(
                "w-full bg-transparent border-none pl-5 pr-12 py-4 text-sm focus:outline-none tracking-tight",
                theme === 'dark' ? "text-white placeholder-white/20" : "text-gray-900 placeholder-gray-400"
              )}
            />
            {isTyping ? (
              <button
                type="button"
                onClick={handleStop}
                className={cn(
                  "absolute right-2 p-2 rounded-xl transition-all",
                  theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-white" : "bg-black/5 hover:bg-black/10 text-gray-900"
                )}
                title="Stop generating"
              >
                <Square className={cn("w-4 h-4", theme === 'dark' ? "fill-white" : "fill-gray-900")} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={cn(
                  "absolute right-2 p-2.5 rounded-xl transition-all shadow-2xl disabled:shadow-none",
                  theme === 'dark' 
                    ? "bg-white text-black hover:bg-white/90 disabled:bg-white/5 disabled:text-white/10" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-300"
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 px-1">
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={makeChart}
                onChange={(e) => { setMakeChart(e.target.checked); if (e.target.checked) setMakeDashboard(false); }}
                className="hidden"
              />
              <div className={cn(
                "w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all",
                makeChart 
                  ? "bg-indigo-600 border-indigo-500 scale-110 shadow-sm" 
                  : (theme === 'dark' ? "bg-white/5 border-white/10 group-hover:border-white/30" : "bg-black/5 border-black/10 group-hover:border-black/20")
              )}>
                {makeChart && <Check className="w-3 h-3 text-white font-black" />}
              </div>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-[0.1em] transition-colors",
                theme === 'dark' ? "text-white/30 group-hover:text-white/60" : "text-gray-400 group-hover:text-gray-700"
              )}>Make Chart</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={makeDashboard}
                onChange={(e) => { setMakeDashboard(e.target.checked); if (e.target.checked) setMakeChart(false); }}
                className="hidden"
              />
              <div className={cn(
                "w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all",
                makeDashboard 
                  ? "bg-indigo-600 border-indigo-500 scale-110 shadow-sm" 
                  : (theme === 'dark' ? "bg-white/5 border-white/10 group-hover:border-white/30" : "bg-black/5 border-black/10 group-hover:border-black/20")
              )}>
                {makeDashboard && <Check className="w-3 h-3 text-white font-black" />}
              </div>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-[0.1em] transition-colors",
                theme === 'dark' ? "text-white/30 group-hover:text-white/60" : "text-gray-400 group-hover:text-gray-700"
              )}>Make Dashboard</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
