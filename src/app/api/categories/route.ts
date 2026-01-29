import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/categories - Get all categories (global + user-specific)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    // Get global categories and user-specific categories if logged in
    const categories = await db.category.findMany({
      where: {
        OR: [
          { userId: null }, // Global categories
          ...(session?.user?.id ? [{ userId: session.user.id }] : []),
        ],
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true, color: true, icon: true },
        },
        children: {
          select: { id: true, name: true, slug: true, color: true, icon: true },
        },
      },
      orderBy: [
        { parentId: 'asc' }, // Parents first (null)
        { name: 'asc' },
      ],
    });

    // Build hierarchical structure
    const parentCategories = categories.filter(c => !c.parentId);
    const hierarchy = parentCategories.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parentId === parent.id),
    }));

    return NextResponse.json({
      categories,
      hierarchy,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST /api/categories - Create a new user-specific category
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, parentSlug } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // If parentSlug provided, find parent category
    let parentCategory = null;
    if (parentSlug) {
      parentCategory = await db.category.findUnique({
        where: { slug: parentSlug },
      });
      
      if (!parentCategory) {
        return NextResponse.json(
          { error: 'Parent category not found' },
          { status: 404 }
        );
      }
    }

    // Create slug with parent prefix if applicable
    const slug = parentCategory 
      ? `${parentCategory.slug}-${baseSlug}`
      : baseSlug;

    // Check if slug already exists
    const existing = await db.category.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this name already exists', existing },
        { status: 409 }
      );
    }

    // Check for similar names (fuzzy match)
    const allCategories = await db.category.findMany({
      where: {
        OR: [
          { userId: null },
          { userId: session.user.id },
        ],
      },
    });

    const normalizedName = name.toLowerCase().trim();
    const similar = allCategories.find(c => {
      const cName = c.name.toLowerCase().trim();
      // Exact match
      if (cName === normalizedName) return true;
      // Substring match
      if (cName.includes(normalizedName) || normalizedName.includes(cName)) return true;
      // Simple Levenshtein distance check (very basic)
      if (Math.abs(cName.length - normalizedName.length) <= 2) {
        let diff = 0;
        for (let i = 0; i < Math.min(cName.length, normalizedName.length); i++) {
          if (cName[i] !== normalizedName[i]) diff++;
        }
        if (diff <= 2) return true;
      }
      return false;
    });

    if (similar) {
      return NextResponse.json({
        warning: 'Similar category exists',
        similar: { id: similar.id, name: similar.name, slug: similar.slug },
      });
    }

    // Create the category
    const category = await db.category.create({
      data: {
        name: name.trim(),
        slug,
        parentId: parentCategory?.id || null,
        color: parentCategory?.color || null,
        userId: session.user.id, // User-specific
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
