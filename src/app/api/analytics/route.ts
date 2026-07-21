import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Timestamp } from 'firebase-admin/firestore'
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
} from 'date-fns'

import { authOptions } from '@/lib/auth-options'
import { db, tsToISO } from '@/lib/firebase-admin'

// ─── Delta helper ─────────────────────────────────────────
function calcDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const now = new Date()

  // ==========================
  // Last 12 months
  // ==========================

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)

    return {
      label: format(d, 'MMM'),
      start: startOfMonth(d),
      end: endOfMonth(d),
    }
  })

  const yearAgo = Timestamp.fromDate(subMonths(now, 12))
  const twoMonthsAgo = Timestamp.fromDate(subMonths(now, 2))

  // Fetch all properties (needed for averages & estates)
  const allPropertiesPromise = db.collection('properties').get()

  // Fetch last year's data for charts
  const yearlyPropertiesPromise = db
    .collection('properties')
    .where('createdAt', '>=', yearAgo)
    .get()

  const usersPromise = db
    .collection('users')
    .where('createdAt', '>=', yearAgo)
    .get()

  const boostsPromise = db.collection('boosts').get()

  // Fetch last 2 months for delta calculations
  const recentPropertiesPromise = db
    .collection('properties')
    .where('createdAt', '>=', twoMonthsAgo)
    .get()

  const recentUsersPromise = db
    .collection('users')
    .where('createdAt', '>=', twoMonthsAgo)
    .get()

  const recentBoostsPromise = db
    .collection('boosts')
    .where('createdAt', '>=', twoMonthsAgo)
    .get()

  const [
    allPropSnap,
    propSnap,
    userSnap,
    boostSnap,
    recentPropSnap,
    recentUserSnap,
    recentBoostSnap,
  ] = await Promise.all([
    allPropertiesPromise,
    yearlyPropertiesPromise,
    usersPromise,
    boostsPromise,
    recentPropertiesPromise,
    recentUsersPromise,
    recentBoostsPromise,
  ])

  // ==========================
  // Listings Per Month
  // ==========================

  const listingsByMonth = months.map(month => {
    return propSnap.docs.filter(doc => {
      const created = new Date(tsToISO(doc.data().createdAt))

      return (
        created >= month.start &&
        created <= month.end
      )
    }).length
  })

  // ==========================
  // Users Per Month
  // ==========================

  const usersByMonth = months.map(month => {
    return userSnap.docs.filter(doc => {
      const created = new Date(tsToISO(doc.data().createdAt))

      return (
        created >= month.start &&
        created <= month.end
      )
    }).length
  })

  // ==========================
  // Boost Revenue
  // ==========================

  const totalRevenue = boostSnap.docs.reduce(
    (sum, doc) => sum + Number(doc.data().amount ?? 0),
    0
  )

  // ==========================
  // Delta Calculations
  // ==========================

  // Listings delta: this month vs last month
  const currentListings = listingsByMonth[listingsByMonth.length - 1] ?? 0
  const previousListings = listingsByMonth[listingsByMonth.length - 2] ?? 0
  const listingsDelta = calcDelta(currentListings, previousListings)

  // Users delta: this month vs last month
  const currentUsers = usersByMonth[usersByMonth.length - 1] ?? 0
  const previousUsers = usersByMonth[usersByMonth.length - 2] ?? 0
  const usersDelta = calcDelta(currentUsers, previousUsers)

  // Revenue delta: this month vs last month
  const thisMonthStart = months[months.length - 1].start
  const thisMonthEnd = months[months.length - 1].end
  const lastMonthStart = months[months.length - 2].start
  const lastMonthEnd = months[months.length - 2].end

  const revenueThisMonth = recentBoostSnap.docs
    .filter(doc => {
      const created = new Date(tsToISO(doc.data().createdAt))
      return created >= thisMonthStart && created <= thisMonthEnd
    })
    .reduce((sum, doc) => sum + Number(doc.data().amount ?? 0), 0)

  const revenueLastMonth = recentBoostSnap.docs
    .filter(doc => {
      const created = new Date(tsToISO(doc.data().createdAt))
      return created >= lastMonthStart && created <= lastMonthEnd
    })
    .reduce((sum, doc) => sum + Number(doc.data().amount ?? 0), 0)

  const revenueDelta = calcDelta(revenueThisMonth, revenueLastMonth)

  // ==========================
  // Property Analytics
  // ==========================

  const typeCounts: Record<string, number> = {}

  const estateMap = new Map<
    string,
    {
      estate: string
      county: string
      count: number
      totalRent: number
      vacant: number
    }
  >()

  let totalViews = 0

  // Track views for delta calculation
  let viewsThisMonth = 0
  let viewsLastMonth = 0
  let listingsThisMonth = 0
  let listingsLastMonth = 0

  allPropSnap.docs.forEach(doc => {
    const property = doc.data()
    const created = new Date(tsToISO(property.createdAt))

    // --------------------------
    // Property Types
    // --------------------------

    const type = property.propertyType ?? 'other'
    typeCounts[type] = (typeCounts[type] ?? 0) + 1

    // --------------------------
    // Views
    // --------------------------

    const views = Number(property.viewCount ?? 0)
    totalViews += isNaN(views) ? 0 : views

    // Track views by month for avgViews delta
    if (created >= thisMonthStart && created <= thisMonthEnd) {
      listingsThisMonth++
      viewsThisMonth += views
    } else if (created >= lastMonthStart && created <= lastMonthEnd) {
      listingsLastMonth++
      viewsLastMonth += views
    }

    // --------------------------
    // Estate
    // --------------------------

    const estate = property.estate ?? 'Unknown'
    const county = property.county ?? '-'

    const rent = Number(
      property.rent ??
      property.price ??
      property.monthlyRent ??
      0
    )

    const isVacant =
      property.status === 'vacant' ||
      property.available === true ||
      property.isOccupied === false ||
      property.occupied === false

    if (!estateMap.has(estate)) {
      estateMap.set(estate, {
        estate,
        county,
        count: 0,
        totalRent: 0,
        vacant: 0,
      })
    }

    const current = estateMap.get(estate)!
    current.count++
    current.totalRent += rent

    if (isVacant) {
      current.vacant++
    }
  })

  // ==========================
  // Average Views
  // ==========================

  const avgViews =
    allPropSnap.size === 0
      ? 0
      : Number((totalViews / allPropSnap.size).toFixed(1))

  // Avg views delta
  const avgViewsCurrent = listingsThisMonth === 0 ? 0 : viewsThisMonth / listingsThisMonth
  const avgViewsPrevious = listingsLastMonth === 0 ? 0 : viewsLastMonth / listingsLastMonth
  const avgViewsDelta = calcDelta(avgViewsCurrent, avgViewsPrevious)

  // ==========================
  // Top Estates
  // ==========================

  const topEstates = [...estateMap.values()]
    .map(e => ({
      estate: e.estate,
      county: e.county,
      count: e.count,
      avgRent:
        e.count === 0
          ? 0
          : Math.round(e.totalRent / e.count),
      vacancy:
        e.count === 0
          ? 0
          : Math.round((e.vacant / e.count) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // ==========================
  // Response
  // ==========================

  return NextResponse.json({
    months: months.map(m => m.label),

    listingsByMonth,
    usersByMonth,

    totalRevenue,
    totalListings: allPropSnap.size,
    totalUsers: userSnap.size,

    typeCounts,

    avgViews,
    topEstates,

    // Dynamic deltas
    listingsDelta,
    usersDelta,
    revenueDelta,
    avgViewsDelta,
  })
}