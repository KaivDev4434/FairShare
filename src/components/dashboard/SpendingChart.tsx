'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { formatCurrency } from '@/lib/calculations';

// Color palette for categories
const COLORS = [
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
];

interface ChartData {
  name: string;
  value: number;
  color?: string;
}

interface SpendingPieChartProps {
  data: ChartData[];
  height?: number;
}

export function SpendingPieChart({ data, height = 300 }: SpendingPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-zinc-500">
        No data to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => 
            `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color || COLORS[index % COLORS.length]} 
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(Number(value) || 0)}
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#a1a1aa' }}
        />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ paddingTop: '20px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface TimeSeriesData {
  date: string;
  amount: number;
  label?: string;
}

interface SpendingLineChartProps {
  data: TimeSeriesData[];
  height?: number;
}

export function SpendingLineChart({ data, height = 300 }: SpendingLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-zinc-500">
        No data to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis 
          dataKey="label" 
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          tickLine={{ stroke: '#27272a' }}
          axisLine={{ stroke: '#27272a' }}
        />
        <YAxis 
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          tickLine={{ stroke: '#27272a' }}
          axisLine={{ stroke: '#27272a' }}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value) || 0)}
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#a1a1aa' }}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, fill: '#10b981' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface BarChartData {
  name: string;
  value: number;
  color?: string;
}

interface SpendingBarChartProps {
  data: BarChartData[];
  height?: number;
  horizontal?: boolean;
}

export function SpendingBarChart({ data, height = 300, horizontal = false }: SpendingBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-zinc-500">
        No data to display
      </div>
    );
  }

  // Sort by value descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart 
          data={sortedData} 
          layout="vertical"
          margin={{ top: 10, right: 10, left: 80, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={true} vertical={false} />
          <XAxis 
            type="number"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickLine={{ stroke: '#27272a' }}
            axisLine={{ stroke: '#27272a' }}
            tickFormatter={(value) => `$${value}`}
          />
          <YAxis 
            type="category"
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickLine={{ stroke: '#27272a' }}
            axisLine={{ stroke: '#27272a' }}
            width={70}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value) || 0)}
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#a1a1aa' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {sortedData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || COLORS[index % COLORS.length]} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sortedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis 
          dataKey="name"
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          tickLine={{ stroke: '#27272a' }}
          axisLine={{ stroke: '#27272a' }}
        />
        <YAxis 
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          tickLine={{ stroke: '#27272a' }}
          axisLine={{ stroke: '#27272a' }}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value) || 0)}
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#a1a1aa' }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {sortedData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color || COLORS[index % COLORS.length]} 
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
