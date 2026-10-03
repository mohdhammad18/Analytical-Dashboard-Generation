import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, LayoutGrid, PieChart, Bell, Search, Menu, X, MessageSquareText, Briefcase, Moon, Sun, BarChart2, Users, TrendingUp } from 'lucide-react';
import logoUrl from '../../assets/logo.png';
import { cn } from '../lib/utils';
import { Dashboard } from './Dashboard';
import { AIChatbot } from './AIChatbot';
import { useTheme } from './ThemeProvider';
import { Workspace, WorkspaceDashboard } from './Workspace';
import { ChartConfig } from './DynamicChart';
import { DashboardConfig } from './DashboardView';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
const BACKEND_URL = rawBackendUrl.replace(/\/$/, '');

export type ChartContext = (
  | {
    contextType: 'chart';
    id: string;
    title: string;
    config: ChartConfig;
  }
  | {
    contextType: 'table';
    id: string;
    title: string;
    tableColumns: string[];
    tableData: Record<string, any>[];
  }
  | {
    contextType: 'kpi';
    id: string;
    title: string;
    value: string | number;
    trend: string;
  }
) & { fullDashboardContext?: any };

interface WorkspaceChart {
  id: string;
  config: ChartConfig;
}

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);
  const [chartContexts, setChartContexts] = useState<ChartContext[]>([]);
  const [workspaceCharts, setWorkspaceCharts] = useState<WorkspaceChart[]>([]);
  const [workspaceDashboards, setWorkspaceDashboards] = useState<WorkspaceDashboard[]>([]);
  const { theme, toggleTheme } = useTheme();

  const groups = [
    {
      title: 'Dashboard',
      items: [
        { icon: LayoutDashboard, label: 'Overview' },
        { icon: BarChart2, label: 'Distributions' },
        { icon: TrendingUp, label: 'KPI Trends' },
        { icon: Users, label: 'Top Users' },
      ]
    },
    {
      title: 'Workspace',
      items: [
        { icon: PieChart, label: 'Charts' },
        { icon: LayoutGrid, label: 'Dashboards' },
      ]
    }
  ];

  const [activePage, setActivePage] = useState('Overview');

  // Load persisted workspace charts and dashboards on mount
  useEffect(() => {
    loadWorkspaceCharts();
    loadWorkspaceDashboards();
  }, []);

  const loadWorkspaceCharts = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/workspace/charts`);
      const charts: WorkspaceChart[] = data.map((c: any) => ({
        id: c.id,
        config: c.chart_config,
      }));
      setWorkspaceCharts(charts);
    } catch {
      // History DB not available — works without it
    }
  };

  const loadWorkspaceDashboards = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/workspace/dashboards`);
      const dashboards: WorkspaceDashboard[] = data.map((d: any) => ({
        id: d.id,
        config: d.dashboard_config,
      }));
      setWorkspaceDashboards(dashboards);
    } catch {
      // History DB not available — works without it
    }
  };

  const handleAddChartContext = (ctx: ChartContext) => {
    setChartContexts(prev =>
      prev.find(c => c.id === ctx.id) ? prev : [...prev, ctx]
    );
    setIsChatbotOpen(true);
  };

  const handleRemoveChartContext = (id: string) => {
    setChartContexts(prev => prev.filter(c => c.id !== id));
  };

  const handleWorkspaceChart = async (config: ChartConfig) => {
    const localId = `ws-${Date.now()}`;
    const newChart: WorkspaceChart = { id: localId, config };
    setWorkspaceCharts(prev => [...prev, newChart]);

    // Persist to backend
    try {
      const { data } = await axios.post(`${BACKEND_URL}/workspace/charts`, {
        title: config.title || 'Untitled Chart',
        chart_config: config,
      });
      // Replace local id with the persisted DB id
      setWorkspaceCharts(prev =>
        prev.map(c => c.id === localId ? { id: data.id, config: c.config } : c)
      );
    } catch {
      // History DB unavailable — chart still in local state
    }
  };

  const handleRemoveWorkspaceChart = async (id: string) => {
    setWorkspaceCharts(prev => prev.filter(c => c.id !== id));
    try {
      await axios.delete(`${BACKEND_URL}/workspace/charts/${id}`);
    } catch {
      // ignore
    }
  };

  const handleWorkspaceDashboard = async (config: DashboardConfig) => {
    const localId = `db-${Date.now()}`;
    const newDashboard: WorkspaceDashboard = { id: localId, config };
    setWorkspaceDashboards(prev => [...prev, newDashboard]);
    setActivePage('Workspace');

    try {
      const { data } = await axios.post(`${BACKEND_URL}/workspace/dashboards`, {
        title: config.title || 'Untitled Dashboard',
        dashboard_config: config,
      });
      setWorkspaceDashboards(prev =>
        prev.map(d => d.id === localId ? { id: data.id, config: d.config } : d)
      );
    } catch {
      // History DB unavailable — dashboard still in local state
    }
  };

  const handleRemoveWorkspaceDashboard = async (id: string) => {
    setWorkspaceDashboards(prev => prev.filter(d => d.id !== id));
    try {
      await axios.delete(`${BACKEND_URL}/workspace/dashboards/${id}`);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative flex h-screen bg-[var(--bg-main)] font-sans text-[var(--text-main)] overflow-hidden transition-colors duration-200">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 bg-[var(--bg-card)] border-r border-[var(--border-main)] transform transition-all duration-300 ease-in-out flex flex-col overflow-hidden",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        isSidebarCollapsed ? "w-16" : "w-52"
      )}>
        <div className="flex-1 flex flex-col h-full">
          {/* Sidebar Toggle Button (Inside Sidebar) */}
          <div className="p-3.5 flex items-center justify-between border-b border-[var(--border-main)]/50 mb-2">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2 text-[var(--text-main)] font-bold text-sm tracking-tight px-1">
                <img src={logoUrl} alt="Frammer AI Logo" className="h-5 w-auto object-contain shrink-0" />
                <span className="text-[var(--text-main)] font-bold ml-1">Frammer AI</span>
              </div>
            )}
            <button
              className={cn(
                "p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-all",
                isSidebarCollapsed ? "mx-auto" : "ml-auto"
              )}
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setIsSidebarOpen(!isSidebarOpen);
                }
              }}
            >
              {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
          </div>

          <nav className="flex-1 px-2.5 space-y-4 mt-2 h-full overflow-y-auto scrollbar-none">
            {groups.map((group) => (
              <div key={group.title} className="space-y-1">
                {!isSidebarCollapsed && (
                  <div className="px-3 mb-2">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                      {group.title}
                    </span>
                  </div>
                )}
                {group.items.map((item) => {
                  const isActive = activePage === item.label;
                  return (
                    <button
                      key={item.label}
                      onClick={() => setActivePage(item.label)}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 py-2",
                        isSidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-3",
                        isActive
                          ? "bg-[var(--brand-bg)] text-[var(--brand)] shadow-sm"
                          : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)]/50 hover:text-[var(--text-main)]"
                      )}
                    >
                      <item.icon className={cn("w-4.5 h-4.5 shrink-0", isActive ? "text-[var(--brand)]" : "text-[var(--text-muted)]")} />
                      {!isSidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {!isSidebarCollapsed && item.label === 'My Workspace' && (workspaceCharts.length + workspaceDashboards.length) > 0 && (
                        <span className="ml-auto bg-[var(--border-main)] text-[var(--brand)] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          {workspaceCharts.length + workspaceDashboards.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-[var(--border-main)]">
            <div className="flex items-center gap-3 px-3">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-[var(--brand)] font-bold text-sm shrink-0">
                U
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                  <p className="text-sm font-medium text-[var(--text-main)] truncate">User</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">Admin</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-[var(--bg-card)]/80 backdrop-blur-sm border-b border-[var(--border-main)] h-16 flex items-center justify-between px-4 sm:px-6 z-10 transition-colors">
          <div className="flex items-center gap-4">
            {isSidebarCollapsed && (
              <div className="flex items-center gap-2 text-[var(--text-main)] font-bold text-lg tracking-tight mr-3 animate-in fade-in duration-300">
                <img src={logoUrl} alt="Frammer AI Logo" className="h-5 w-auto object-contain shrink-0" />
                <span className="hidden sm:inline-block text-[var(--text-main)] font-bold ml-1">Frammer AI</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={toggleTheme}
              className={cn(
                "relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out p-0.5",
                theme === 'dark' ? "bg-[var(--brand)]" : "bg-[var(--border-main)]"
              )}
              title="Toggle theme"
              role="switch"
              aria-checked={theme === 'dark'}
            >
              <span className="sr-only">Toggle theme</span>
              <span
                className={cn(
                  "pointer-events-none flex items-center justify-center h-6 w-6 transform rounded-full shadow-md transition-all duration-300 ease-in-out z-10",
                  theme === 'dark' ? "translate-x-7 bg-[#1e1e1e]" : "translate-x-0 bg-white"
                )}
              >
                {theme === 'dark' ? <Moon className="h-3.5 w-3.5 text-indigo-400" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
              </span>
            </button>

            <button
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300",
                isChatbotOpen
                  ? "bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-md"
                  : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 hover:text-white hover:shadow-md"
              )}
              onClick={() => setIsChatbotOpen(!isChatbotOpen)}
            >
              <MessageSquareText className="w-4 h-4" />
              <span className="hidden sm:inline font-bold tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>InsightArc</span>
              {chartContexts.length > 0 && (
                <span className="ml-1 bg-[var(--brand)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {chartContexts.length}
                </span>
              )}
            </button>
          </div>
        </header>
        <main className="flex-1 flex overflow-hidden relative">
          {(activePage === 'Overview' || activePage === 'Dashboard') ? (
            <Dashboard onAddChartContext={handleAddChartContext} />
          ) : (activePage === 'Charts') ? (
            <Workspace
              key="workspace-charts"
              charts={workspaceCharts}
              onRemoveChart={handleRemoveWorkspaceChart}
              dashboards={workspaceDashboards}
              onRemoveDashboard={handleRemoveWorkspaceDashboard}
              preferredTab="charts"
            />
          ) : (activePage === 'Dashboards') ? (
            <Workspace
              key="workspace-dashboards"
              charts={workspaceCharts}
              onRemoveChart={handleRemoveWorkspaceChart}
              dashboards={workspaceDashboards}
              onRemoveDashboard={handleRemoveWorkspaceDashboard}
              preferredTab="dashboards"
            />
          ) : activePage === 'Distributions' ? (
            <Dashboard mode="distributions" onAddChartContext={handleAddChartContext} />
          ) : activePage === 'Top Users' ? (
            <Dashboard mode="performance" onAddChartContext={handleAddChartContext} />
          ) : (activePage === 'KPI Trends' || activePage === 'KPI Metrics') ? (
            <Dashboard mode="kpi_metrics" onAddChartContext={handleAddChartContext} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] bg-[var(--bg-main)]">
              {activePage} (Coming Soon)
            </div>
          )}

          <div className={cn(
            "absolute inset-y-0 right-0 lg:static transform transition-transform duration-300 ease-in-out z-30 max-w-full overflow-hidden",
            isChatbotOpen ? "translate-x-0" : "translate-x-full lg:hidden"
          )}>
            {isChatbotOpen && (
              <AIChatbot
                chartContexts={chartContexts}
                onRemoveChartContext={handleRemoveChartContext}
                onAddChartContext={handleAddChartContext}
                onWorkspaceChart={handleWorkspaceChart}
                onWorkspaceDashboard={handleWorkspaceDashboard}
                onClose={() => setIsChatbotOpen(false)}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
