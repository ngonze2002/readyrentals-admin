import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db, tsToISO } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { Report } from '@/types'

/* ─────────────────────────────────────────────────────────
   GET  /api/reports?status=open|actioned|dismissed
   ───────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'
  const priority = searchParams.get('priority') // 'high' | 'normal' | null

  try {
    let query = db
      .collection('reports')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')

    if (priority) {
      query = query.where('priority', '==', priority)
    }

    const snap = await query.get()

    // Enrich with landlord stats (repeat-offender check)
    const enriched = await Promise.all(
      snap.docs.map(async (d) => {
        // use any here because Firestore doc data may include optional fields
        const data = d.data() as any

        // Count how many reports this landlord has
        let landlordReportCount = 0
        let propertyReportCount = 0
        let landlordSuspended = false
        let propertyStatus: string | null = null
        let propertyPublished: boolean | null = null

        if ((data as any).landlordId) {
          const [landlordReports, propertyReports, landlordSnap] = await Promise.all([
            db.collection('reports').where('landlordId', '==', data.landlordId).count().get(),
            db.collection('reports').where('propertyId', '==', data.propertyId).count().get(),
            db.collection('users').doc(data.landlordId).get(),
          ])
          landlordReportCount = landlordReports.data().count
          propertyReportCount = propertyReports.data().count
          landlordSuspended = landlordSnap.data()?.isSuspended ?? false
        }

        if ((data as any).propertyId) {
          const propertySnap = await db.collection('properties').doc(data.propertyId).get()
          const propertyData = propertySnap.data()
          propertyStatus = propertyData?.listingStatus ?? null
          propertyPublished = propertyData?.isPublished ?? null
        }

        return {
          id: d.id,
          ...data,
          createdAt: tsToISO(data.createdAt),
          landlordReportCount,
          propertyReportCount,
          landlordSuspended,
          propertyStatus,
          propertyPublished,
        }
      })
    )

    return NextResponse.json({ data: enriched })
  } catch (err: any) {
    console.error('GET /api/reports error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ─────────────────────────────────────────────────────────
   PATCH  /api/reports
   Body: {
     id: string
     action: 'contact' | 'flag' | 'remove' | 'ban' | 'dismiss'
             | 'unflag' | 'restore' | 'unsuspend'
     adminNote?: string
     removeProperty?: boolean   // legacy / extra flag
   }
   ───────────────────────────────────────────────────────── */
const FORWARD_ACTIONS = ['contact', 'flag', 'remove', 'ban', 'dismiss'] as const
const REVERSAL_ACTIONS = ['unflag', 'restore', 'unsuspend'] as const

type ForwardAction = (typeof FORWARD_ACTIONS)[number]
type ReversalAction = (typeof REVERSAL_ACTIONS)[number]

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // session.user may not have uid on NextAuth types; cast to any to access possible uid/id
  const adminUid = (session.user as any)?.uid ?? (session.user as any)?.id ?? 'unknown'

  const body: {
    id: string
    action: ForwardAction | ReversalAction
    adminNote?: string
    removeProperty?: boolean
  } = await req.json()

  const { id, action, adminNote, removeProperty } = body

  try {
    const reportRef = db.collection('reports').doc(id)
    const reportSnap = await reportRef.get()

    if (!reportSnap.exists) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const report = reportSnap.data() as Report
    const rAny = report as any
    const propertyId = rAny.propertyId ?? null
    const landlordId = rAny.landlordId ?? null

    const batch = db.batch()
    const now = FieldValue.serverTimestamp()

    /* ═══════════════════════════════════════════════════════
       REVERSAL ACTIONS — unflag / restore / unsuspend
       These undo a previous decision on an already-actioned
       report. The report itself stays "actioned" (its history
       is preserved); we record the reversal separately.
       ═══════════════════════════════════════════════════════ */
    if ((REVERSAL_ACTIONS as readonly string[]).includes(action)) {
      if (report.status !== 'actioned') {
        return NextResponse.json(
          { error: 'Only actioned reports can be reversed' },
          { status: 400 }
        )
      }

      if (action === 'unflag') {
        if (!propertyId) {
          return NextResponse.json({ error: 'Report has no associated property' }, { status: 400 })
        }
        const propertySnap = await db.collection('properties').doc(propertyId).get()
        if (propertySnap.data()?.listingStatus !== 'under_review') {
          return NextResponse.json(
            { error: 'Listing is not currently under review' },
            { status: 400 }
          )
        }
        batch.update(db.collection('properties').doc(propertyId), {
          listingStatus: 'published',
          flaggedAt: FieldValue.delete(),
          flaggedReason: FieldValue.delete(),
          updatedAt: now,
        })
      }

      if (action === 'restore') {
        if (!propertyId) {
          return NextResponse.json({ error: 'Report has no associated property' }, { status: 400 })
        }
        const propertySnap = await db.collection('properties').doc(propertyId).get()
        if (propertySnap.data()?.listingStatus !== 'removed') {
          return NextResponse.json(
            { error: 'Listing is not currently removed' },
            { status: 400 }
          )
        }
        batch.update(db.collection('properties').doc(propertyId), {
          isPublished: true,
          listingStatus: 'published',
          removedAt: FieldValue.delete(),
          removalReason: FieldValue.delete(),
          removedBy: FieldValue.delete(),
          updatedAt: now,
        })
      }

      if (action === 'unsuspend') {
        if (!landlordId) {
          return NextResponse.json({ error: 'Report has no associated landlord' }, { status: 400 })
        }
        const landlordSnap = await db.collection('users').doc(landlordId).get()
        if (!landlordSnap.data()?.isSuspended) {
          return NextResponse.json(
            { error: 'Landlord is not currently suspended' },
            { status: 400 }
          )
        }
        batch.update(db.collection('users').doc(landlordId), {
          isSuspended: false,
          suspensionReason: FieldValue.delete(),
          suspendedAt: FieldValue.delete(),
          suspendedBy: FieldValue.delete(),
          updatedAt: now,
        })

        // Restore only the listings that were removed as a *result* of
        // this suspension (not ones separately removed for other reasons).
        const landlordProps = await db
          .collection('properties')
          .where('landlordId', '==', landlordId)
          .where('removalReason', '==', 'landlord_suspended')
          .get()

        landlordProps.docs.forEach((p) => {
          batch.update(p.ref, {
            isPublished: true,
            listingStatus: 'published',
            removedAt: FieldValue.delete(),
            removalReason: FieldValue.delete(),
            removedBy: FieldValue.delete(),
            updatedAt: now,
          })
        })
      }

      // Record the reversal on the report without altering its
      // original resolution/status — that history stays intact.
      batch.update(reportRef, {
        reversedAction: action,
        reversedBy: adminUid,
        reversedAt: now,
        reversalNote: adminNote ?? null,
        updatedAt: now,
      })

      const auditRef = db.collection('admin_audit_logs').doc()
      batch.set(auditRef, {
        type: 'report_reversal',
        reportId: id,
        propertyId,
        landlordId,
        action,
        adminUid,
        adminNote: adminNote ?? null,
        timestamp: now,
      })

      await batch.commit()
      return NextResponse.json({ ok: true, action, reportId: id })
    }

    /* ═══════════════════════════════════════════════════════
       FORWARD ACTIONS — contact / flag / remove / ban / dismiss
       (original behaviour, unchanged)
       ═══════════════════════════════════════════════════════ */

    /* ── 1. Update the report doc ── */
    const statusMap: Record<string, string> = {
      contact: 'actioned',
      flag: 'actioned',
      remove: 'actioned',
      ban: 'actioned',
      dismiss: 'dismissed',
    }

    batch.update(reportRef, {
      status: statusMap[action] ?? 'actioned',
      resolution: action,
      adminNote: adminNote ?? null,
      reviewedBy: adminUid,
      reviewedAt: now,
      updatedAt: now,
    })

    /* ── 2. Property-level actions ── */
    if (propertyId) {
      const propertyRef = db.collection('properties').doc(report.propertyId)

      // FLAG  → mark as under review
      if (action === 'flag') {
        batch.update(propertyRef, {
          listingStatus: 'under_review',
          flaggedAt: now,
          flaggedReason: report.reason,
          updatedAt: now,
        })
      }

      // REMOVE or BAN  → unpublish (soft-delete)
      if (action === 'remove' || action === 'ban' || removeProperty) {
        batch.update(propertyRef, {
          isPublished: false,
          listingStatus: 'removed',
          removedAt: now,
          removalReason: rAny.reason,
          removedBy: adminUid,
          updatedAt: now,
        })
      }
    }

    /* ── 3. Landlord-level actions ── */
    if (landlordId) {
      const landlordRef = db.collection('users').doc(landlordId)

      // BAN  → suspend landlord
      if (action === 'ban') {
        batch.update(landlordRef, {
          isSuspended: true,
          suspensionReason: 'fake_listing',
          suspendedAt: now,
          suspendedBy: adminUid,
          // increment violation counter
          violationCount: FieldValue.increment(1),
          updatedAt: now,
        })

        // Optionally: unpublish ALL properties by this landlord
        const landlordProps = await db
          .collection('properties')
          .where('landlordId', '==', landlordId)
          .where('isPublished', '==', true)
          .get()

        landlordProps.docs.forEach((p) => {
          batch.update(p.ref, {
            isPublished: false,
            listingStatus: 'removed',
            removedAt: now,
            removalReason: 'landlord_suspended',
            updatedAt: now,
          })
        })
      }

      // CONTACT  → log that admin reached out (optional)
      if (action === 'contact') {
        batch.update(landlordRef, {
          lastAdminContactAt: now,
          updatedAt: now,
        })
      }
    }

    /* ── 4. Create an admin audit log entry ── */
    const auditRef = db.collection('admin_audit_logs').doc()
    batch.set(auditRef, {
      type: 'report_action',
      reportId: id,
      propertyId: propertyId,
      landlordId: landlordId,
      action,
      adminUid,
      adminNote: adminNote ?? null,
      timestamp: now,
    })

    await batch.commit()

    return NextResponse.json({ ok: true, action, reportId: id })
  } catch (err: any) {
    console.error('PATCH /api/reports error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}