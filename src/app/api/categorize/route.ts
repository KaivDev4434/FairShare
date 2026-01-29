import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { categorizeItems, ItemToCategorize } from '@/lib/categorize';

// POST /api/categorize - Categorize items using LLM with keyword fallback
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { items } = body as { items: ItemToCategorize[] };
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }
    
    const suggestions = await categorizeItems(items, session?.user?.id);
    
    return NextResponse.json({ 
      suggestions,
    });
  } catch (error) {
    console.error('Error categorizing items:', error);
    return NextResponse.json(
      { error: 'Failed to categorize items' },
      { status: 500 }
    );
  }
}
