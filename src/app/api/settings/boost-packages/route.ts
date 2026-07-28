import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const snapshot = await db
    .collection('boost_packages')
    .orderBy('order')
    .get();

  const packages = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return NextResponse.json(packages);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    /**
     * Expected payload:
     *
     * [
     *   { id: "bronze", price: 700 },
     *   { id: "silver", price: 1100 },
     *   { id: "gold", price: 1600 }
     * ]
     */

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const batch = db.batch();

    for (const pkg of body) {
      if (!pkg.id) continue;

      const ref = db.collection('boost_packages').doc(pkg.id);

      batch.set(
        ref,
        {
          price: Number(pkg.price),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Boost pricing updated successfully',
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update pricing',
      },
      { status: 500 }
    );
  }
}