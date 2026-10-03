import React, { useState, useEffect, useRef } from 'react';
import { fetchDashboardData, DashboardData } from '../data/mockData';
import { DynamicChart, ChartConfig } from './DynamicChart';
import { ArrowUpRight, ArrowDownRight, Video, UploadCloud, PlayCircle, Clock, BrainCircuit, Expand, X, ChevronDown } from 'lucide-react';
import { ChartContext } from './Layout';
import { CHART_COLORS } from '../constants/colors';
import { DraggableContainer } from './DraggableContainer';
import { cn } from '../lib/utils';

interface DashboardProps {
  onAddChartContext: (ctx: ChartContext) => void;
  mode?: 'overview' | 'distributions' | 'performance' | 'kpi_metrics';
}

// ChartCard — draggable wrapper for charts
function ChartCard({
  id, title, className = '', getDragData, dashboardData, children,
}: {
  id: string;
  title?: string;
  className?: string;
  getDragData: () => object;
  dashboardData?: any;
  onAddContext?: (ctx: any) => void;
  children: React.ReactNode;
}) {
  return (
    <DraggableContainer
      id={id}
      getDragData={getDragData}
      dashboardData={dashboardData}
      className={className}
    >
      {children}
    </DraggableContainer>
  );
}

// TableCard — draggable wrapper for tables
function TableCard({
  id, title, columns, rows, dashboardData, children,
}: {
  id: string;
  title: string;
  columns: string[];
  rows: Record<string, any>[];
  dashboardData?: any;
  onAddContext?: (ctx: any) => void;
  children: React.ReactNode;
}) {
  const getDragData = () => ({
    contextType: 'table' as const,
    id,
    title,
    tableColumns: columns,
    tableData: rows,
  });
  return (
    <DraggableContainer
      id={id}
      getDragData={getDragData}
      dashboardData={dashboardData}
    >
      {children}
    </DraggableContainer>
  );
}

// KPICard — draggable wrapper for KPIs
function KPICard({
  id, title, value, trend, dashboardData, children,
}: {
  id: string;
  title: string;
  value: string | number;
  trend: string;
  dashboardData?: any;
  onAddContext?: (ctx: any) => void;
  children: React.ReactNode;
  key?: string | number;
}) {
  const getDragData = () => ({
    contextType: 'kpi' as const,
    id,
    title,
    value,
    trend,
  });
  return (
    <DraggableContainer
      id={id}
      getDragData={getDragData}
      dashboardData={dashboardData}
    >
      {children}
    </DraggableContainer>
  );
}

// Helper function to filter monthWiseData based on time range.
function filterMonthWiseData(data: any[], range: string) {
  const now = new Date(Date.now());
  const parseMonth = (monthStr: string): Date => {
    const safeStr = monthStr.replace(',', '');
    const [mon, year] = safeStr.split(' ');
    if (!year) return new Date(`${monthStr} 1, ${now.getFullYear()}`);
    return new Date(`${mon} 1, ${year}`);
  };
  // Support both 'Month' (API) and 'month' (legacy) keys
  const getMonth = (d: any) => d['Month'] ?? d['month'] ?? '';

  if (range === 'Last 30 Days') {
    const cutoff = new Date(Date.now());
    cutoff.setDate(cutoff.getDate() - 30);
    return data.filter(d => parseMonth(getMonth(d)) >= cutoff);
  } else if (range === 'Last 3 Months') {
    const cutoff = new Date(Date.now());
    cutoff.setMonth(cutoff.getMonth() - 3);
    return data.filter(d => parseMonth(getMonth(d)) >= cutoff);
  } else if (range === 'This Year') {
    const currentYear = now.getFullYear();
    return data.filter(d => parseMonth(getMonth(d)).getFullYear() === currentYear);
  } else {
    return data;
  }
}

export function Dashboard({ onAddChartContext, mode = 'overview' }: DashboardProps) {
  const [selectedRange, setSelectedRange] = useState('All Time');
  const [metricView, setMetricView] = useState<'volume' | 'duration'>('volume');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChannelExpand, setShowChannelExpand] = useState(false);
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rangeRef.current && !rangeRef.current.contains(event.target as Node)) {
        setIsRangeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const CACHE_KEY = 'dashboard_data_cache_v3';
    const CACHE_TIME_KEY = 'dashboard_data_cache_time_v3';
    const CACHE_TTL = 300000;
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();

    if (cached && cachedTime && (now - parseInt(cachedTime)) < CACHE_TTL) {
      try {
        setData(JSON.parse(cached));
        setLoading(false);
      } catch (e) { console.error(e); }
    }

    fetchDashboardData()
      .then(fetchedData => {
        const processedMonthWiseData = (fetchedData.monthWiseData || []).map((item: any) => ({
          ...item,
          total_uploaded: Number(item.total_uploaded || 0),
          total_created: Number(item.total_created || 0),
          total_published: Number(item.total_published || 0),
          // Also keep original keys if they exist, or map them for compatibility
          Month: item.month || item.Month,
          'Total Uploaded': Number(item.total_uploaded || item['Total Uploaded'] || 0),
          'Total Created': Number(item.total_created || item['Total Created'] || 0),
          'Total Published': Number(item.total_published || item['Total Published'] || 0),
        }));

        const finalData = {
          ...fetchedData,
          monthWiseData: processedMonthWiseData
        };

        setData(finalData);
        setLoading(false);
        localStorage.setItem(CACHE_KEY, JSON.stringify(finalData));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center p-4"><div className="text-gray-500">Loading dashboard data...</div></div>;
  if (!data) return <div className="flex-1 flex items-center justify-center p-4"><div className="text-red-500">Failed to load data</div></div>;

  const {
    monthWiseData = [],
    outputTypeData = [],
    inputTypeData = [],
    languageData = [],
    channelData = [],
    userData = [],
    blueprint
  } = data;

  const kpi = data.kpiData;
  const totalUploaded = Number(kpi?.totalUploaded ?? 0);
  const totalCreated = Number(kpi?.totalCreated ?? 0);
  const totalPublished = Number(kpi?.totalPublished ?? 0);
  const conversionRate = totalCreated > 0 ? ((totalPublished / totalCreated) * 100).toFixed(2) : '0.00';

  const trendDataSrc = monthWiseData || [];

  const calculateTrend = (key: string) => {
    if (trendDataSrc.length < 2) return '+0%';
    const latest = trendDataSrc[trendDataSrc.length - 1];
    const prev = trendDataSrc[trendDataSrc.length - 2];
    const latestVal = Number(latest?.[key] ?? 0);
    const prevVal = Number(prev?.[key] ?? 0);
    if (prevVal === 0) return '+0%';
    const pct = ((latestVal - prevVal) / prevVal) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
  };

  const uploadTrend = calculateTrend('total_uploaded');
  const createTrend = calculateTrend('total_created');
  const publishTrend = calculateTrend('total_published');

  const latestM = trendDataSrc[trendDataSrc.length - 1];
  const prevM = trendDataSrc[trendDataSrc.length - 2];
  const latestConv = (Number(latestM?.total_published ?? 0) / (Number(latestM?.total_created ?? 0) || 1)) * 100;
  const prevConv = (Number(prevM?.total_published ?? 0) / (Number(prevM?.total_created ?? 0) || 1)) * 100;
  const convTrendChange = latestConv - prevConv;
  const convTrend = `${convTrendChange >= 0 ? '+' : ''}${convTrendChange.toFixed(0)}%`;

  const kpiCards = [
    {
      title: metricView === 'volume' ? 'Total Uploaded' : 'Total Uploaded Time',
      value: metricView === 'volume' ? totalUploaded.toLocaleString() : (kpi?.totalUploadedDuration ?? '00:00:00'),
      icon: UploadCloud, color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/10 dark:bg-[#00D4AA]/20', trend: uploadTrend, accentClass: 'dark:glass-accent-teal'
    },
    {
      title: metricView === 'volume' ? 'Total Created' : 'Total Created Time',
      value: metricView === 'volume' ? totalCreated.toLocaleString() : (kpi?.totalCreatedDuration ?? '00:00:00'),
      icon: Video, color: 'text-[#6C63FF]', bg: 'bg-[#6C63FF]/10 dark:bg-[#6C63FF]/20', trend: createTrend, accentClass: 'dark:glass-accent-violet'
    },
    {
      title: metricView === 'volume' ? 'Total Published' : 'Total Published Time',
      value: metricView === 'volume' ? totalPublished.toLocaleString() : (kpi?.totalPublishedDuration ?? '00:00:00'),
      icon: PlayCircle, color: 'text-[#FF6B6B]', bg: 'bg-[#FF6B6B]/10 dark:bg-[#FF6B6B]/20', trend: publishTrend, accentClass: 'dark:glass-accent-coral'
    },
    {
      title: metricView === 'volume' ? 'Conversion Rate' : 'Duration Efficiency',
      value: metricView === 'volume'
        ? `${conversionRate}%`
        : `${(totalPublished / (totalCreated || 1) * 100).toFixed(2)}%`,
      icon: Clock, color: 'text-[#F5A623]', bg: 'bg-[#F5A623]/10 dark:bg-[#F5A623]/20', trend: convTrend, accentClass: 'dark:glass-accent-amber'
    },
  ];

  const filteredMonthWiseData = filterMonthWiseData(trendDataSrc, selectedRange);

  const monthWiseConfigFiltered: ChartConfig = {
    type: 'area',
    title: 'Monthly Content Trends',
    data: filteredMonthWiseData,
    xAxisKey: 'month',
    series: [
      { key: 'total_created', name: 'Created', color: CHART_COLORS.CREATED },
      { key: 'total_uploaded', name: 'Uploaded', color: CHART_COLORS.UPLOADED },
      { key: 'total_published', name: 'Published', color: CHART_COLORS.PUBLISHED },
    ]
  };

  const sortedChannelData = [...channelData].sort((a, b) => (b.created_count || 0) - (a.created_count || 0));
  const topChannels = sortedChannelData.slice(0, 5);
  const otherChannelsCount = sortedChannelData.slice(5).reduce((acc, curr) => acc + (curr.created_count || 0), 0);
  const processedChannelData = otherChannelsCount > 0
    ? [...topChannels, { channel: 'Others', created_count: otherChannelsCount }]
    : topChannels;

  const channelConfig: ChartConfig = {
    type: 'pie',
    title: 'Channel Distribution (Created)',
    data: processedChannelData,
    xAxisKey: 'channel',
    series: [{ key: 'created_count', name: 'Created' }]
  };

  const uploadedTrendConfig: ChartConfig = {
    type: 'area',
    title: 'Total Uploaded Trend',
    data: filteredMonthWiseData,
    xAxisKey: 'month',
    series: [{ key: 'total_uploaded', name: 'Uploaded', color: '#3b82f6' }]
  };

  const createdTrendConfig: ChartConfig = {
    type: 'area',
    title: 'Total Created Trend',
    data: filteredMonthWiseData,
    xAxisKey: 'month',
    series: [{ key: 'total_created', name: 'Created', color: '#6366f1' }]
  };

  const publishedTrendConfig: ChartConfig = {
    type: 'area',
    title: 'Total Published Trend',
    data: filteredMonthWiseData,
    xAxisKey: 'month',
    series: [{ key: 'total_published', name: 'Published', color: '#10b981' }]
  };

  const blueprintOutputConfig: ChartConfig = {
    type: 'bar',
    data: blueprint?.outputData || [],
    xAxisKey: 'name',
    series: [
      { key: 'created', name: 'Created', color: CHART_COLORS.CREATED },
      { key: 'published', name: 'Published', color: CHART_COLORS.PUBLISHED }
    ]
  };

  const blueprintInputConfig: ChartConfig = {
    type: 'bar',
    data: blueprint?.inputData || [],
    xAxisKey: 'name',
    layout: 'vertical',
    series: [{ key: 'published', name: 'Published Items', color: CHART_COLORS.PUBLISHED }]
  };

  const languageConfig: ChartConfig = {
    type: 'pie',
    data: blueprint?.languageData || [],
    xAxisKey: 'language',
    innerRadius: 50,
    series: [{ key: 'published', name: 'Published' }]
  };

  const platformConfig: ChartConfig = {
    type: 'pie',
    data: blueprint?.platformData || [],
    xAxisKey: 'platform',
    innerRadius: 50,
    series: [{ key: 'published', name: 'Published' }]
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[var(--bg-main)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-[var(--bg-glass)] relative z-50 backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-main)]">
                {mode === 'overview' ? 'Analytics Overview' :
                  mode === 'distributions' ? 'Content Distributions' :
                    mode === 'performance' ? 'Top Users Performance' :
                      'KPI Metrics'}
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                {mode === 'distributions' ? 'Analysis of input, output, and language distributions.' :
                  mode === 'performance' ? 'Detailed user performance and win rates.' :
                    mode === 'kpi_metrics' ? 'Detailed KPI trends, efficiency ratings, and publishing metrics.' :
                      'Monitor your AI video conversion performance.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {mode === 'overview' && (
                <div className="flex items-center bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-main)] mr-2 shadow-sm">
                  <button onClick={() => setMetricView('volume')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${metricView === 'volume' ? 'bg-[var(--brand-bg)] text-[var(--brand)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}><Video className="w-3.5 h-3.5" />Volume</button>
                  <button onClick={() => setMetricView('duration')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${metricView === 'duration' ? 'bg-[var(--brand-bg)] text-[var(--brand)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}><Clock className="w-3.5 h-3.5" />Duration</button>
                </div>
              )}
              {mode === 'overview' && (
                <div className="relative w-36" ref={rangeRef}>
                  <button
                    onClick={() => setIsRangeOpen(!isRangeOpen)}
                    className={`flex items-center justify-between w-full bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-main)] hover:bg-[var(--bg-surface)] text-xs font-semibold px-3 py-1.5 transition-colors relative z-50 ${isRangeOpen ? 'rounded-t-xl rounded-b-none border-b-transparent' : 'rounded-xl shadow-sm'
                      }`}
                  >
                    <span>{selectedRange}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 flex-shrink-0 ${isRangeOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isRangeOpen && (
                    <div className="absolute left-0 top-full w-full bg-[var(--bg-card)] border border-[var(--border-main)] border-t-0 rounded-b-xl shadow-lg z-40 overflow-hidden -translate-y-[1px]">
                      <div className="flex flex-col p-1 gap-0.5">
                        {['Last 30 Days', 'Last 3 Months', 'This Year', 'All Time'].map((range) => (
                          <button
                            key={range}
                            onClick={() => {
                              setSelectedRange(range);
                              setIsRangeOpen(false);
                            }}
                            className={`flex items-center w-full px-3 py-1.5 text-xs text-left rounded-lg transition-colors ${selectedRange === range
                                ? 'bg-[var(--brand-bg)] text-[var(--brand)] font-medium'
                                : 'text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-surface)]'
                              }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {mode === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {kpiCards.map((kpi, index) => (
                <KPICard key={index} id={`kpi-${index}`} title={kpi.title} value={kpi.value} trend={kpi.trend} dashboardData={data} onAddContext={onAddChartContext}>
                  <div className={`bg-[var(--bg-glass)] backdrop-blur-xl rounded-2xl p-4 lg:p-5 border border-[var(--border-glass)] shadow-glass flex flex-col justify-between h-full ${kpi.accentClass || ''}`}>
                    <div className="flex justify-between items-start">
                      <div className={`p-2 rounded-lg ${kpi.bg} bg-opacity-10 dark:bg-opacity-20`}><kpi.icon className={`w-5 h-5 ${kpi.color}`} /></div>
                      <span className={`text-xs font-medium flex items-center gap-1 ${kpi.trend.startsWith('+') ? 'text-emerald-500' : 'text-blue-500'}`}>{kpi.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{kpi.trend}</span>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between">
                      <span className={`text-xs font-medium flex items-center gap-1 ${kpi.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {kpi.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{kpi.trend}
                      </span>
                    </div>
                  </div>
                </KPICard>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <ChartCard id="monthly-trends" title="Monthly Content Trends" className="lg:col-span-2" dashboardData={data} onAddContext={onAddChartContext} getDragData={() => ({ contextType: 'chart', id: 'monthly-trends', title: 'Monthly Content Trends', config: monthWiseConfigFiltered })}>
                <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass h-full min-h-[400px]"><DynamicChart config={monthWiseConfigFiltered} /></div>
              </ChartCard>
              <ChartCard id="channel-dist" title="Channel Distribution" dashboardData={data} onAddContext={onAddChartContext} getDragData={() => ({ contextType: 'chart', id: 'channel-dist', title: 'Channel Distribution', config: channelConfig })}>
                <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass h-full min-h-[400px] relative">
                  <div className="absolute top-4 right-4 z-20"><button onClick={() => setShowChannelExpand(true)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"><Expand className="w-4 h-4" /></button></div>
                  <DynamicChart config={channelConfig} />
                </div>
              </ChartCard>
            </div>
          </div>
        )}

        {mode === 'kpi_metrics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[uploadedTrendConfig, createdTrendConfig, publishedTrendConfig].map((cfg, i) => (
                <div key={i} className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass h-[360px]"><DynamicChart config={cfg} /></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-8 rounded-2xl border border-[var(--border-glass)] shadow-glass flex flex-col justify-center items-center min-h-[200px]">
                <UploadCloud className="w-8 h-8 text-[var(--brand)] mb-4" />
                <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">Efficiency Rating</h3>
                <p className="text-4xl font-extrabold text-[var(--brand)]">{(Number(data.kpiData.totalCreated) / Number(data.kpiData.totalUploaded)).toFixed(2)}</p>
              </div>
              <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-8 rounded-2xl border border-[var(--border-glass)] shadow-glass flex flex-col justify-center items-center min-h-[200px]">
                <PlayCircle className="w-8 h-8 text-blue-600 mb-4" />
                <p className="text-3xl font-bold text-[var(--text-muted)] mb-1">Conversion Rate</p>
                <p className="text-4xl font-extrabold text-blue-600">{((Number(data.kpiData.totalPublished) / Number(data.kpiData.totalCreated)) * 100).toFixed(2)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Output Type Analysis */}
              <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass space-y-6">
                <div className="h-[300px]">
                  <DynamicChart config={{
                    type: 'bar',
                    title: 'Output Type Success',
                    data: [
                      { name: 'Full package', created: 4453, published: 35 },
                      { name: 'Key moments', created: 6377, published: 41 },
                      { name: 'Chapters', created: 2007, published: 2 },
                    ],
                    xAxisKey: 'name',
                    series: [
                      { key: 'created', name: 'Created', color: CHART_COLORS.CREATED },
                      { key: 'published', name: 'Published', color: CHART_COLORS.PUBLISHED }
                    ]
                  }} />
                </div>
                <div className="overflow-hidden bg-[var(--bg-surface)] rounded-xl border border-[var(--border-main)]">
                  <table className="w-full text-[11px] text-left">
                    <thead className="text-[var(--text-muted)] uppercase border-b border-[var(--border-main)] bg-[var(--bg-surface)]">
                      <tr><th className="px-4 py-2">Output Format</th><th className="px-4 py-2 text-right">Created</th><th className="px-4 py-2 text-right">Published</th><th className="px-4 py-2 text-right">Rate %</th></tr>
                    </thead>
                    <tbody>
                      {[
                        { n: 'Full package', c: 4453, p: 35 },
                        { n: 'Key moments', c: 6377, p: 41 },
                        { n: 'Chapters', c: 2007, p: 2 }
                      ].map(r => (
                        <tr key={r.n} className="border-b border-[var(--border-main)]/50 last:border-0 hover:bg-[var(--brand)]/5 transition-colors"><td className="px-4 py-2 font-medium text-[var(--text-main)]">{r.n}</td><td className="px-4 py-2 text-right">{r.c}</td><td className="px-4 py-2 text-right text-[var(--brand)] font-bold">{r.p}</td><td className="px-4 py-2 text-right">{((r.p / r.c) * 100).toFixed(2)}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Language Quality Analysis */}
              <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass space-y-6">
                <div className="h-[300px]">
                  <DynamicChart config={{
                    type: 'pie',
                    title: 'Published by Language',
                    data: [
                      { language: 'English (en)', published: 91, created: 8861 },
                      { language: 'Hindi (hi)', published: 20, created: 6021 },
                    ],
                    xAxisKey: 'language',
                    innerRadius: 60,
                    series: [{ key: 'published', name: 'Published' }]
                  }} />
                </div>
                <div className="overflow-hidden bg-[var(--bg-surface)] rounded-xl border border-[var(--border-main)]">
                  <table className="w-full text-[11px] text-left">
                    <thead className="text-[var(--text-muted)] uppercase border-b border-[var(--border-main)] bg-[var(--bg-surface)]">
                      <tr><th className="px-4 py-2">Language</th><th className="px-4 py-2 text-right">Created</th><th className="px-4 py-2 text-right">Published</th><th className="px-4 py-2 text-right">Rate %</th></tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[var(--border-main)]/50 hover:bg-[var(--brand)]/5"><td className="px-4 py-2 text-[var(--text-main)]">English (en)</td><td className="px-4 py-2 text-right">8,861</td><td className="px-4 py-2 text-right text-[var(--brand)] font-bold">91</td><td className="px-4 py-2 text-right">1.03%</td></tr>
                      <tr className="hover:bg-[var(--brand)]/5"><td className="px-4 py-2 text-[var(--text-main)]">Hindi (hi)</td><td className="px-4 py-2 text-right">6,021</td><td className="px-4 py-2 text-right text-[var(--brand)] font-bold">20</td><td className="px-4 py-2 text-right">0.33%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Input Category Analysis */}
              <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass space-y-6">
                <div className="h-[300px]">
                  <DynamicChart config={{
                    type: 'bar',
                    title: 'Top Categories',
                    layout: 'vertical',
                    data: [
                      { name: 'News Bulletins', published: 39 },
                      { name: 'Interviews', published: 35 },
                      { name: 'Special Reports', published: 15 },
                    ].sort((a, b) => b.published - a.published),
                    xAxisKey: 'name',
                    series: [{ key: 'published', name: 'Published', color: CHART_COLORS.PUBLISHED }]
                  }} />
                </div>
                <div className="p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-main)] flex items-center justify-center text-center italic text-[11px] text-[var(--text-muted)]">
                   <p>Comprehensive category analysis and win-rate performance metrics.</p>
                </div>
              </div>

              {/* Platform Analysis */}
              <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass space-y-6">
                <div className="h-[300px]">
                  <DynamicChart config={{
                    type: 'pie',
                    title: 'Platform Breakdown',
                    data: [
                      { platform: 'YouTube', published: 25 },
                      { platform: 'Shorts', published: 4 },
                      { platform: 'Facebook', published: 2 },
                    ],
                    xAxisKey: 'platform',
                    innerRadius: 60,
                    series: [{ key: 'published', name: 'Published' }]
                  }} />
                </div>
                <div className="overflow-hidden bg-[var(--bg-surface)] rounded-xl border border-[var(--border-main)]">
                  <table className="w-full text-[11px] text-left">
                    <thead className="text-[var(--text-muted)] uppercase border-b border-[var(--border-main)] bg-[var(--bg-surface)]">
                      <tr><th className="px-4 py-2">Platform</th><th className="px-4 py-2 text-right">Published Count</th></tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[var(--border-main)]/50 hover:bg-[var(--brand)]/5"><td className="px-4 py-2 text-[var(--text-main)] font-medium">YouTube</td><td className="px-4 py-2 text-right font-bold text-[var(--brand)]">25</td></tr>
                      <tr className="border-b border-[var(--border-main)]/50 hover:bg-[var(--brand)]/5"><td className="px-4 py-2 text-[var(--text-main)] font-medium">Shorts</td><td className="px-4 py-2 text-right font-bold text-[var(--brand)]">4</td></tr>
                      <tr><td className="px-4 py-2 text-[var(--text-main)] font-medium">Facebook</td><td className="px-4 py-2 text-right font-bold text-[var(--brand)]">2</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'distributions' && (
          <div className="space-y-8">
            {[
              { title: 'Output Type', data: outputTypeData, key: 'output_type' },
              { title: 'Input Type', data: inputTypeData, key: 'input_type' },
              { title: 'Language', data: languageData, key: 'language' }
            ].filter(dist => dist.data && dist.data.length > 0).map((dist, i) => (
              <div key={i} className="space-y-4">
                <div className="inline-block bg-[var(--bg-glass)] backdrop-blur-md px-4 py-2 rounded-xl border border-[var(--border-glass)] shadow-sm">
                  <h2 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider">{dist.title} Distribution</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartCard
                    id={`dist-${dist.key}-vol`}
                    title={`${dist.title} Volume`}
                    dashboardData={data}
                    getDragData={() => ({
                      contextType: 'chart',
                      id: `dist-${dist.key}-vol`,
                      title: `${dist.title} Volume`,
                      config: { type: 'bar', title: 'Volume', data: dist.data, xAxisKey: dist.key, series: [{ key: 'uploaded_count', name: 'Uploaded', color: CHART_COLORS.UPLOADED }, { key: 'created_count', name: 'Created', color: CHART_COLORS.CREATED }, { key: 'published_count', name: 'Published', color: CHART_COLORS.PUBLISHED }] }
                    })}
                  >
                    <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass h-[400px]">
                      <DynamicChart config={{ type: 'bar', title: 'Volume', data: dist.data, xAxisKey: dist.key, series: [{ key: 'uploaded_count', name: 'Uploaded', color: CHART_COLORS.UPLOADED }, { key: 'created_count', name: 'Created', color: CHART_COLORS.CREATED }, { key: 'published_count', name: 'Published', color: CHART_COLORS.PUBLISHED }] }} />
                    </div>
                  </ChartCard>
                  <ChartCard
                    id={`dist-${dist.key}-hrs`}
                    title={`${dist.title} Hours`}
                    dashboardData={data}
                    getDragData={() => ({
                      contextType: 'chart',
                      id: `dist-${dist.key}-hrs`,
                      title: `${dist.title} Hours`,
                      config: { type: 'bar', title: 'Hours', data: dist.data, xAxisKey: dist.key, series: [{ key: 'uploaded_hours', name: 'Uploaded hrs', color: CHART_COLORS.UPLOADED }, { key: 'created_hours', name: 'Created hrs', color: CHART_COLORS.CREATED }, { key: 'published_hours', name: 'Published hrs', color: CHART_COLORS.PUBLISHED }] }
                    })}
                  >
                    <div className="bg-[var(--bg-glass)] backdrop-blur-xl p-6 rounded-2xl border border-[var(--border-glass)] shadow-glass h-[400px]">
                      <DynamicChart config={{ type: 'bar', title: 'Hours', data: dist.data, xAxisKey: dist.key, series: [{ key: 'uploaded_hours', name: 'Uploaded hrs', color: CHART_COLORS.UPLOADED }, { key: 'created_hours', name: 'Created hrs', color: CHART_COLORS.CREATED }, { key: 'published_hours', name: 'Published hrs', color: CHART_COLORS.PUBLISHED }] }} />
                    </div>
                  </ChartCard>
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === 'performance' && (
          <TableCard
            id="user-performance"
            title="User Performance Metrics"
            columns={['User', 'Uploaded', 'Created', 'Published', 'Win Rate']}
            rows={[...userData].sort((a, b) => { const wrA = (a.published_count / (a.uploaded_count || 1)); const wrB = (b.published_count / (b.uploaded_count || 1)); return wrB - wrA; }).slice(0, 15)}
            dashboardData={data}
          >
            <div className="bg-[var(--bg-glass)] backdrop-blur-xl rounded-2xl border border-[var(--border-glass)] shadow-glass overflow-hidden">
              <div className="p-6 border-b border-[var(--border-main)] flex justify-between items-center"><h3 className="text-sm font-semibold text-[var(--text-main)]">User Performance (Win Rate)</h3><span className="text-xs text-[var(--text-muted)]">{userData.length} Users Tracked</span></div>
              <div className="overflow-x-auto scrollbar-premium"><table className="w-full text-sm text-left text-[var(--text-muted)] min-w-[650px]"><thead className="text-xs text-[var(--text-muted)] uppercase bg-[var(--bg-surface)]"><tr><th className="px-6 py-3">User</th><th className="px-6 py-3">Uploaded</th><th className="px-6 py-3">Created</th><th className="px-6 py-3">Published</th><th className="px-6 py-3">Win Rate (%)</th></tr></thead><tbody>{[...userData].sort((a, b) => { const wrA = (a.published_count / (a.uploaded_count || 1)); const wrB = (b.published_count / (b.uploaded_count || 1)); return wrB - wrA; }).slice(0, 15).map((user, index) => { const winRate = ((user.published_count / (user.uploaded_count || 1)) * 100); return (<tr key={index} className="bg-[var(--bg-card)] border-b border-[var(--border-main)] hover:bg-[var(--bg-surface)]"><td className="px-6 py-4 font-medium text-[var(--text-main)] max-w-[150px] truncate" title={user.user}>{user.user}</td><td className="px-6 py-4">{user.uploaded_count}</td><td className="px-6 py-4">{user.created_count}</td><td className="px-6 py-4">{user.published_count}</td><td className="px-6 py-4"><div className="flex items-center gap-2"><div className="w-full bg-[var(--bg-surface)] rounded-full h-1.5 max-w-15"><div className="bg-[var(--brand)] h-1.5 rounded-full" style={{ width: `${Math.min(100, winRate)}%` }}></div></div><span className="text-xs font-bold text-[var(--brand)]">{winRate.toFixed(2)}%</span></div></td></tr>); })}</tbody></table></div>
            </div>
          </TableCard>
        )}
      </div>

      {showChannelExpand && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowChannelExpand(false)} />
          <div className="bg-[var(--bg-glass)] backdrop-blur-2xl rounded-3xl shadow-glass border border-[var(--border-glass)] w-full max-w-6xl h-[80vh] flex flex-col relative animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between shrink-0"><div><h3 className="text-xl font-bold text-[var(--text-main)]">Channel Performance Metrics</h3></div><button onClick={() => setShowChannelExpand(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"><X className="w-6 h-6" /></button></div>
            <div className="flex-1 p-8 min-h-0"><DynamicChart config={{ type: 'bar', title: 'Detailed Channel Distribution', data: channelData, xAxisKey: 'channel', series: [{ key: 'uploaded_count', name: 'Uploaded', color: CHART_COLORS.UPLOADED }, { key: 'created_count', name: 'Created', color: CHART_COLORS.CREATED }, { key: 'published_count', name: 'Published', color: CHART_COLORS.PUBLISHED }] }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}