import React from 'react';
import { BarChart2, Hash, Table2, AlertTriangle } from 'lucide-react';
import { DynamicChart, ChartConfig } from './DynamicChart';
import { KPICard } from './KPICard';
import { DraggableContainer } from './DraggableContainer';

export interface DashboardPanel {
  id: string;
  panel_type: 'kpi' | 'chart' | 'table';
  title: string;
  status: string;
  error?: string | null;
  layout: { x: number; y: number; w: number; h: number };
  chart_config?: ChartConfig | null;
  kpi_value?: string | number | null;
  kpi_label?: string | null;
  kpi_change?: string | null;
  kpi_trend?: 'up' | 'down' | 'neutral' | null;
  table_data?: Record<string, any>[] | null;
  table_columns?: string[] | null;
}

export interface DashboardConfig {
  title: string;
  description: string;
  panels: DashboardPanel[];
  error?: string;
}

interface DashboardViewProps {
  config: DashboardConfig;
}

// Map layout width (1-12 columns) to Tailwind col-span classes
const colSpanClass: Record<number, string> = {
  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
  5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
  9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12',
};

// Map layout height (row units) to panel min-height classes
const rowHeightClass: Record<number, string> = {
  1: 'min-h-[110px]',
  2: 'min-h-[260px]',
  3: 'min-h-[380px]',
};

export function DashboardView({ config }: DashboardViewProps) {
  if (!config.panels || config.panels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--text-muted)]">
        <AlertTriangle className="w-8 h-8 mb-3 text-amber-400" />
        <p className="text-sm font-medium">{config.error || 'No panels could be generated for this dashboard.'}</p>
      </div>
    );
  }

  // Sort panels by row (y) then column (x) for consistent rendering order
  const sorted = [...config.panels].sort((a, b) =>
    a.layout.y !== b.layout.y ? a.layout.y - b.layout.y : a.layout.x - b.layout.x
  );

  return (
    <div className="w-full grid grid-cols-12 gap-4">
      {sorted.map((panel) => {
        const colClass = colSpanClass[Math.min(12, Math.max(1, panel.layout.w))] ?? 'col-span-6';
        const heightClass = rowHeightClass[Math.min(3, Math.max(1, panel.layout.h))] ?? 'min-h-[260px]';

        return (
          <DraggableContainer
            key={panel.id}
            id={panel.id}
            className={colClass}
            getDragData={() => {
              if (panel.panel_type === 'kpi') {
                return { contextType: 'kpi', id: panel.id, title: panel.title, value: panel.kpi_value, trend: panel.kpi_trend };
              } else if (panel.panel_type === 'chart' && panel.chart_config) {
                return { contextType: 'chart', id: panel.id, title: panel.title, config: panel.chart_config };
              } else if (panel.panel_type === 'table') {
                return { contextType: 'table', id: panel.id, title: panel.title, tableColumns: panel.table_columns, tableData: panel.table_data };
              }
              return { id: panel.id, title: panel.title };
            }}
          >
            <div className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] shadow-sm overflow-hidden flex flex-col h-full ${heightClass}`}>
              <PanelHeader panel={panel} />
              <div className="flex-1 overflow-auto p-3 min-h-0">
                <PanelContent panel={panel} />
              </div>
            </div>
          </DraggableContainer>
        );
      })}
    </div>
  );
}

function PanelHeader({ panel }: { panel: DashboardPanel }) {
  const Icon = panel.panel_type === 'kpi' ? Hash
    : panel.panel_type === 'chart' ? BarChart2
    : Table2;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-main)] bg-[var(--bg-surface)]/50 shrink-0">
      <Icon className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
      <span className="text-xs font-semibold text-[var(--text-main)] truncate">{panel.title}</span>
    </div>
  );
}

function PanelContent({ panel }: { panel: DashboardPanel }) {
  if (panel.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-xs gap-1.5">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <span>Failed to load data</span>
      </div>
    );
  }

  switch (panel.panel_type) {
    case 'kpi':
      return (
        <KPICard
          value={panel.kpi_value ?? '—'}
          label={panel.kpi_label ?? panel.title}
          change={panel.kpi_change ?? undefined}
          trend={(panel.kpi_trend as 'up' | 'down' | 'neutral') ?? 'neutral'}
        />
      );

    case 'chart':
      if (!panel.chart_config) {
        return <div className="flex items-center justify-center h-full text-gray-400 text-xs">No chart data</div>;
      }
      return (
        <div className="w-full h-full min-h-[180px]">
          <DynamicChart config={panel.chart_config as ChartConfig} />
        </div>
      );

    case 'table':
      return <PanelTable data={panel.table_data} columns={panel.table_columns} />;

    default:
      return <div className="text-gray-400 text-xs">Unknown panel type</div>;
  }
}

function PanelTable({ data, columns }: { data?: Record<string, any>[] | null; columns?: string[] | null }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-xs">No data</div>;
  }

  const cols = columns ?? Object.keys(data[0]);

  return (
    <div className="overflow-auto h-full scrollbar-premium">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border-main)]">
            {cols.map((col) => (
              <th key={col} className="text-left py-1.5 px-2 font-semibold text-[var(--text-muted)] whitespace-nowrap sticky top-0 bg-[var(--bg-card)]">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-[var(--border-main)]/30 hover:bg-[var(--bg-surface)]/50 transition-colors">
              {cols.map((col) => (
                <td key={col} className="py-1.5 px-2 text-[var(--text-main)] whitespace-nowrap">
                  {row[col] != null ? String(row[col]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
