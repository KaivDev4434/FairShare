import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { categorizeItems } from '@/lib/categorize';

// GET /api/bills - List all bills (filtered by ownership or participation)
export async function GET() {
  try {
    const session = await auth();

    // Build where clause based on authentication
    let whereClause = {};

    if (session?.user?.id) {
      // Logged in: show bills where user is owner OR participant
      whereClause = {
        OR: [
          { userId: session.user.id },                              // Bills I own
          { shares: { some: { userId: session.user.id } } },        // Bills I participate in
          { userId: null },                                          // Old bills (no owner) - accessible to all
        ],
      };
    }
    // If not logged in: show all bills (for backwards compat with legacy bills)

    const bills = await db.bill.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            category: {
              include: {
                parent: {
                  select: { id: true, name: true, slug: true, color: true },
                },
              },
            },
          },
        },
        shares: {
          include: {
            claims: true,
          },
        },
      },
    });

    return NextResponse.json(bills);
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bills' },
      { status: 500 }
    );
  }
}

// POST /api/bills - Create a new bill
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { name, items, taxAmount = 0, tipAmount = 0, subtotal, total } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Bill name is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Validate all items
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        return NextResponse.json(
          { error: 'All items must have a name' },
          { status: 400 }
        );
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        return NextResponse.json(
          { error: 'All items must have a valid price (0 or more)' },
          { status: 400 }
        );
      }
      if (item.quantity !== undefined && (typeof item.quantity !== 'number' || item.quantity < 1)) {
        return NextResponse.json(
          { error: 'Item quantities must be at least 1' },
          { status: 400 }
        );
      }
    }

    // Calculate subtotal if not provided
    const calculatedSubtotal = subtotal ?? items.reduce(
      (sum: number, item: { price: number; quantity?: number }) =>
        sum + item.price * (item.quantity || 1),
      0
    );

    // Calculate total if not provided
    const calculatedTotal = total ?? (calculatedSubtotal + taxAmount + tipAmount);

    // Auto-categorize items using the categorization function
    let categorizedItems: Array<{ name: string; price: number; quantity: number; categoryId?: string | null }> =
      items.map((item: { name: string; price: number; quantity?: number }) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        categoryId: null,
      }));

    try {
      const suggestions = await categorizeItems(
        categorizedItems.map(item => ({ name: item.name, price: item.price })),
        session?.user?.id
      );

      // Map category IDs to items
      categorizedItems = categorizedItems.map((item, index) => ({
        ...item,
        categoryId: suggestions[index]?.categoryId || null,
      }));
      console.log('[Bills] Auto-categorized', categorizedItems.length, 'items');
    } catch (catError) {
      // Categorization is optional - continue without it
      console.log('[Bills] Auto-categorization failed, continuing without categories:', catError);
    }

    const bill = await db.bill.create({
      data: {
        name,
        taxAmount,
        tipAmount,
        subtotal: calculatedSubtotal,
        total: calculatedTotal,
        // Link to user if logged in
        userId: session?.user?.id || null,
        items: {
          create: categorizedItems.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            categoryId: item.categoryId || null,
          })),
        },
      },
      include: {
        items: {
          include: {
            category: {
              include: {
                parent: {
                  select: { id: true, name: true, slug: true, color: true },
                },
              },
            },
          },
        },
        shares: true,
      },
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json(
      { error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}

