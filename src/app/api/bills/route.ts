import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

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
    // If not logged in: show all bills (for backwards compat / guest mode)
    
    const bills = await db.bill.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
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
    
    if (!name || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing required fields: name and items' },
        { status: 400 }
      );
    }
    
    // Calculate subtotal if not provided
    const calculatedSubtotal = subtotal ?? items.reduce(
      (sum: number, item: { price: number; quantity?: number }) => 
        sum + item.price * (item.quantity || 1),
      0
    );
    
    // Calculate total if not provided
    const calculatedTotal = total ?? (calculatedSubtotal + taxAmount + tipAmount);
    
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
          create: items.map((item: { name: string; price: number; quantity?: number }) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
          })),
        },
      },
      include: {
        items: true,
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

