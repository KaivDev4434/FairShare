import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/bills/[id] - Get a single bill with all details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            claims: {
              include: {
                share: true,
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
    
    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(bill);
  } catch (error) {
    console.error('Error fetching bill:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bill' },
      { status: 500 }
    );
  }
}

// PATCH /api/bills/[id] - Update a bill
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, taxAmount, tipAmount, locked, items } = body;
    
    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (taxAmount !== undefined) updateData.taxAmount = taxAmount;
    if (tipAmount !== undefined) updateData.tipAmount = tipAmount;
    if (locked !== undefined) updateData.locked = locked;
    
    // If items are provided, update them
    if (items && Array.isArray(items)) {
      // Delete existing items and recreate
      await db.item.deleteMany({ where: { billId: id } });
      
      updateData.items = {
        create: items.map((item: { name: string; price: number; quantity?: number }) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
        })),
      };
      
      // Recalculate subtotal and total
      const subtotal = items.reduce(
        (sum: number, item: { price: number; quantity?: number }) =>
          sum + item.price * (item.quantity || 1),
        0
      );
      updateData.subtotal = subtotal;
      updateData.total = subtotal + (taxAmount ?? 0) + (tipAmount ?? 0);
    }
    
    const bill = await db.bill.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        shares: {
          include: {
            claims: true,
          },
        },
      },
    });
    
    return NextResponse.json(bill);
  } catch (error) {
    console.error('Error updating bill:', error);
    return NextResponse.json(
      { error: 'Failed to update bill' },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[id] - Delete a bill
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Delete in order to handle foreign key constraints
    // First delete all claims for items in this bill
    await db.claim.deleteMany({
      where: {
        item: { billId: id }
      }
    });
    
    // Delete all claims for shares in this bill
    await db.claim.deleteMany({
      where: {
        share: { billId: id }
      }
    });
    
    // Delete all items
    await db.item.deleteMany({ where: { billId: id } });
    
    // Delete all shares
    await db.share.deleteMany({ where: { billId: id } });
    
    // Finally delete the bill
    await db.bill.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json(
      { error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}

