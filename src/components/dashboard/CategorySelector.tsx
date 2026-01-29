'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  parentId?: string | null;
  parent?: {
    id: string;
    name: string;
    slug: string;
    color?: string | null;
  } | null;
  children?: Category[];
}

interface CategorySelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (category: Category) => void;
  currentCategoryId?: string | null;
}

const COLOR_MAP: Record<string, string> = {
  orange: 'border-orange-500/50 hover:bg-orange-500/10',
  blue: 'border-blue-500/50 hover:bg-blue-500/10',
  purple: 'border-purple-500/50 hover:bg-purple-500/10',
  pink: 'border-pink-500/50 hover:bg-pink-500/10',
  yellow: 'border-yellow-500/50 hover:bg-yellow-500/10',
  red: 'border-red-500/50 hover:bg-red-500/10',
  cyan: 'border-cyan-500/50 hover:bg-cyan-500/10',
  indigo: 'border-indigo-500/50 hover:bg-indigo-500/10',
  gray: 'border-zinc-500/50 hover:bg-zinc-500/10',
};

export function CategorySelector({
  open,
  onOpenChange,
  onSelect,
  currentCategoryId,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [hierarchy, setHierarchy] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
        setHierarchy(data.hierarchy);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter categories based on search
  const filteredHierarchy = useMemo(() => {
    if (!search) return hierarchy;
    
    const searchLower = search.toLowerCase();
    return hierarchy
      .map(parent => ({
        ...parent,
        children: parent.children?.filter(child =>
          child.name.toLowerCase().includes(searchLower) ||
          parent.name.toLowerCase().includes(searchLower)
        ) || [],
      }))
      .filter(parent =>
        parent.name.toLowerCase().includes(searchLower) ||
        (parent.children && parent.children.length > 0)
      );
  }, [hierarchy, search]);

  const handleSelect = (category: Category) => {
    onSelect(category);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Category</DialogTitle>
        </DialogHeader>
        
        {/* Search */}
        <div className="relative">
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-zinc-800 border-zinc-700"
          />
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : filteredHierarchy.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              No categories found
            </div>
          ) : (
            filteredHierarchy.map((parent) => (
              <div key={parent.id} className="space-y-2">
                {/* Parent Category */}
                <button
                  onClick={() => handleSelect(parent)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left
                    ${currentCategoryId === parent.id 
                      ? 'bg-emerald-600/20 border-emerald-600/50' 
                      : `border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50`
                    }
                  `}
                >
                  {parent.icon && <span className="text-lg">{parent.icon}</span>}
                  <span className="font-medium">{parent.name}</span>
                </button>
                
                {/* Children */}
                {parent.children && parent.children.length > 0 && (
                  <div className="ml-4 pl-4 border-l border-zinc-800 space-y-1">
                    {parent.children.map((child) => {
                      const color = child.color || parent.color || 'gray';
                      const colorClasses = COLOR_MAP[color] || COLOR_MAP.gray;
                      
                      return (
                        <button
                          key={child.id}
                          onClick={() => handleSelect(child)}
                          className={`
                            w-full flex items-center gap-2 p-2 rounded-lg border transition-colors text-left text-sm
                            ${currentCategoryId === child.id 
                              ? 'bg-emerald-600/20 border-emerald-600/50' 
                              : colorClasses
                            }
                          `}
                        >
                          {child.icon && <span>{child.icon}</span>}
                          <span>{child.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Clear selection */}
        {currentCategoryId && (
          <Button
            variant="outline"
            className="mt-2 border-zinc-700"
            onClick={() => {
              onSelect({ id: '', name: 'Uncategorized', slug: '' });
              onOpenChange(false);
            }}
          >
            Clear Category
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
