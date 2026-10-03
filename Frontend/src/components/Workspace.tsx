import React, { useState } from 'react';
import { X, BarChart2, LayoutGrid, Sparkles, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { DynamicChart, ChartConfig } from './DynamicChart';
import { DashboardView, DashboardConfig } from './DashboardView';
import { DraggableContainer } from './DraggableContainer';
import { BrainCircuit } from 'lucide-react';

interface WorkspaceChart {
  id: string;
  config: ChartConfig;
}

export interface WorkspaceDashboard {
  id: string;
  config: DashboardConfig;
}

interface WorkspaceProps {
  charts: WorkspaceChart[];
  onRemoveChart: (id: string) => void;
  dashboards: WorkspaceDashboard[];
  onRemoveDashboard: (id: string) => void;
  preferredTab?: Tab;
}

type Tab = 'charts' | 'dashboards';

export function Workspace({ charts, onRemoveChart, dashboards, onRemoveDashboard, preferredTab }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>(preferredTab || (dashboards.length > 0 ? 'dashboards' : 'charts'));
  
  // Sync state if prop changes from outside (sidebar navigation)
  React.useEffect(() => {
    if (preferredTab) {
      setActiveTab(preferredTab);
    }
  }, [preferredTab]);

  const [expandedDashboard, setExpandedDashboard] = useState<string | null>(
    dashboards.length > 0 ? dashboards[dashboards.length - 1]?.id ?? null : null
  );

  const tabs: { key: Tab; label: string; count: number; icon: React.ElementType }[] = [
    { key: 'charts', label: 'Charts', count: charts.length, icon: BarChart2 },
    { key: 'dashboards', label: 'Dashboards', count: dashboards.length, icon: LayoutGrid },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[var(--bg-main)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-main)]">
            {activeTab === 'charts' ? 'Generated Charts' : 'AI Dashboards'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {activeTab === 'charts' 
              ? 'Your custom AI-generated data visualizations' 
              : 'Full analytical layouts created by the AI Agent'}
          </p>
        </div>

        {/* Charts tab */}
        {activeTab === 'charts' && (
          charts.length === 0 ? (
            <EmptyState
              title="No charts yet"
              description='Open the AI Agent panel, enable "Make Chart", and ask a data question. Generated charts will appear here.'
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {charts.map((chart) => (
                <DraggableContainer
                  key={chart.id}
                  id={chart.id}
                  getDragData={() => ({
                    contextType: 'chart' as const,
                    id: chart.id,
                    title: chart.config.title || 'Untitled Chart',
                    config: chart.config
                  })}
                >
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] shadow-sm overflow-hidden group">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-main)]">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-[var(--brand)]" />
                      <span className="text-sm font-semibold text-[var(--text-main)] truncate">
                        {chart.config.title || 'Untitled Chart'}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveChart(chart.id)}
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--brand-bg)] transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove chart"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5 h-72">
                    <DynamicChart config={chart.config} />
                  </div>
                </div>
                </DraggableContainer>
              ))}
            </div>
          )
        )}

        {/* Dashboards tab */}
        {activeTab === 'dashboards' && (
          dashboards.length === 0 ? (
            <EmptyState
              title="No dashboards yet"
              description='Open the AI Agent panel, enable "Make Dashboard", and describe the dashboard you want. Generated dashboards will appear here.'
            />
          ) : (
            <div className="space-y-4">
              {dashboards.map((db) => {
                const isExpanded = expandedDashboard === db.id;
                return (
                  <div key={db.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] shadow-sm overflow-hidden">
                    <div
                      className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[var(--bg-surface)] transition-colors"
                      onClick={() => setExpandedDashboard(isExpanded ? null : db.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                          : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                        }
                        <LayoutGrid className="w-4 h-4 text-[var(--brand)]" />
                        <div>
                          <span className="text-sm font-semibold text-[var(--text-main)]">
                            {db.config.title || 'Untitled Dashboard'}
                          </span>
                          {db.config.description && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{db.config.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          {db.config.panels?.length ?? 0} panels
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveDashboard(db.id); }}
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--brand-bg)] transition-colors"
                          title="Remove dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-[var(--border-main)] p-4">
                        <DashboardView config={db.config} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 bg-[var(--brand-bg)] rounded-full mb-4">
        <Sparkles className="w-8 h-8 text-[var(--brand)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-main)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] max-w-sm">{description}</p>
    </div>
  );
}
