'use client';

import { Badge } from '@/components/ui/badge';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  parent?: {
    name: string;
    slug: string;
    color?: string | null;
  } | null;
}

interface CategoryBadgeProps {
  category?: Category | null;
  showParent?: boolean;
  size?: 'sm' | 'default';
  onClick?: () => void;
}

const COLOR_MAP: Record<string, string> = {
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  gray: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function CategoryBadge({ 
  category, 
  showParent = false, 
  size = 'default',
  onClick 
}: CategoryBadgeProps) {
  if (!category) {
    return (
      <Badge 
        variant="outline" 
        className={`
          border-zinc-700 text-zinc-500
          ${size === 'sm' ? 'text-xs px-1.5 py-0' : ''}
          ${onClick ? 'cursor-pointer hover:border-zinc-600' : ''}
        `}
        onClick={onClick}
      >
        Uncategorized
      </Badge>
    );
  }

  const color = category.parent?.color || category.color || 'gray';
  const colorClasses = COLOR_MAP[color] || COLOR_MAP.gray;
  const displayName = showParent && category.parent 
    ? `${category.parent.name} > ${category.name}`
    : category.name;

  return (
    <Badge 
      variant="outline"
      className={`
        ${colorClasses}
        ${size === 'sm' ? 'text-xs px-1.5 py-0' : ''}
        ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
      `}
      onClick={onClick}
      title={category.parent ? `${category.parent.name} > ${category.name}` : category.name}
    >
      {category.icon && <span className="mr-1">{category.icon}</span>}
      {displayName}
    </Badge>
  );
}
