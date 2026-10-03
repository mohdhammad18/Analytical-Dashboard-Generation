import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { CHART_PALETTE } from '../constants/colors';

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'funnel';
  data: any[];
  xAxisKey?: string;
  series: {
    key: string;
    name?: string;
    color?: string;
  }[];
  title?: string;
  layout?: 'horizontal' | 'vertical'; // for bar charts
  innerRadius?: number; // for pie/donut charts
}

const DEFAULT_MARGIN = { top: 10, right: 30, left: 0, bottom: 0 };

const getMonochromaticPalette = (baseColor: string, count: number) => {
  if (count <= 1) return [baseColor];
  const baseShades = ['#5B6ABF', '#6C7BC6', '#7D8CCD', '#8E9DD4', '#9FAEDB', '#B0BFE2', '#C1D0E9', '#D2E1F0',];
  return Array.from({ length: count }).map((_, i) => baseShades[i % baseShades.length]);
};

// Aggregate data into Top 4 + Others
const aggregateTop4AndOthers = (data: any[], dataKey: string, nameKey: string) => {
  if (!data || data.length <= 5) return data;
  
  const sorted = [...data].sort((a, b) => (b[dataKey] || 0) - (a[dataKey] || 0));
  const top4 = sorted.slice(0, 4);
  const others = sorted.slice(4);
  
  const othersValue = others.reduce((acc, curr) => acc + (curr[dataKey] || 0), 0);
  
  return [
    ...top4,
    { [nameKey]: 'Others', [dataKey]: othersValue }
  ];
};

export function DynamicChart({ config }: { config: ChartConfig }) {
  if (!config || !config.data || config.data.length === 0) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)]">No data available</div>;
  }

  const renderChart = () => {
    switch (config.type) {
      case 'bar': {
        const isVertical = config.layout === 'vertical';
        return (
          <BarChart
            data={config.data}
            margin={isVertical ? { ...DEFAULT_MARGIN, left: 40 } : DEFAULT_MARGIN}
            barGap={2}
            barCategoryGap="20%"
            layout={config.layout || 'horizontal'}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
            {isVertical ? (
              <>
                <XAxis type="number" hide />
                <YAxis
                  dataKey={config.xAxisKey || 'name'}
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  width={100}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={config.xAxisKey || 'name'}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={10}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              </>
            )}
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                boxShadow: 'var(--shadow-premium)'
              }}
            />
            <Legend iconType="circle" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
            {config.series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name || s.key}
                fill={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                barSize={18}
              />
            ))}
          </BarChart>
        );
      }
      case 'line':
        return (
          <LineChart data={config.data} margin={DEFAULT_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
            <XAxis
              dataKey={config.xAxisKey || 'name'}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={10}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', boxShadow: 'var(--shadow-premium)' }}
            />
            <Legend iconType="circle" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '20px', color: 'var(--text-muted)' }} />
            {config.series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name || s.key}
                stroke={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={config.data} margin={DEFAULT_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
            <XAxis
              dataKey={config.xAxisKey || 'name'}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={10}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', boxShadow: 'var(--shadow-premium)' }}
            />
            <Legend iconType="circle" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '20px', color: 'var(--text-muted)' }} />
            {config.series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name || s.key}
                fill={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                stroke={s.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        );
      case 'pie':
        const dataKey = config.series[0]?.key || 'value';
        const nameKey = config.xAxisKey || 'name';
        return (
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', boxShadow: 'var(--shadow-premium)' }}
            />
            <Legend iconType="circle" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '20px', color: 'var(--text-muted)' }} />
            <Pie
              data={config.data}
              dataKey={dataKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={config.innerRadius ?? (config.series.length > 1 ? 40 : 0)}
              fill={CHART_PALETTE[0]}
              labelLine={false}
            >
              {config.data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={CHART_PALETTE[index % CHART_PALETTE.length]} 
                />
              ))}
            </Pie>
          </PieChart>
        );
      case 'funnel': {
        const dataKey = config.series[0]?.key || 'value';
        const nameKey = config.xAxisKey || 'name';
        return (
          <FunnelChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', boxShadow: 'var(--shadow-premium)' }}
            />
            <Funnel
              dataKey={dataKey}
              data={config.data}
              isAnimationActive
            >
              <LabelList position="right" fill="var(--text-main)" stroke="none" dataKey={nameKey} />
              {config.data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={CHART_PALETTE[index % CHART_PALETTE.length]} 
                />
              ))}
            </Funnel>
          </FunnelChart>
        );
      }
      default:
        return <div className="flex items-center justify-center h-full text-[var(--text-muted)]">Unsupported chart type</div>;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {config.title && <h3 className="text-sm font-semibold text-[var(--text-main)] mb-4">{config.title}</h3>}
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
