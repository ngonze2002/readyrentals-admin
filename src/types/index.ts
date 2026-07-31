// ── Property ───────────────────────────────────────────────
export type PropertyStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'occupied'
  | 'vacant'
  | 'active'
  | 'under_review'
  | 'removed'

export interface Property {
  id: string
  landlordId: string
  landlordName: string
  landlordPhone: string
  title: string
  description: string
  rent: number
  deposit: number
  propertyType: string
  county: string
  town: string
  estate: string
  latitude: number
  longitude: number
  imageUrls: string[]
  amenities: string[]
  status: PropertyStatus
  isVerified: boolean
  isBoosted: boolean
  boostedUntil?: string
  viewCount: number
  createdAt: string
  updatedAt: string
  rejectionReason?: string
  adminNote?: string
}

// ── User ───────────────────────────────────────────────────
export type UserRole   = 'tenant' | 'landlord' | 'admin'
export type UserStatus = 'active' | 'pending' | 'suspended'

export interface AppUser {
  uid: string
  fullName: string
  phone: string
  email: string
  role: UserRole
  status: UserStatus
  isVerified: boolean
  photoUrl?: string
  nationalId?: string
  listingCount?: number
  createdAt: string
}

// ── Report ─────────────────────────────────────────────────
export type ReportStatus = 'open' | 'actioned' | 'dismissed'

export interface Report {
  id: string
  propertyId: string
  propertyTitle: string
  reporterUid: string
  reporterName: string
  reason: string
  details?: string
  status: ReportStatus
  createdAt: string
  resolvedAt?: string
  adminNote?: string
  resolution?: 'contact' | 'flag' | 'remove' | 'ban' | 'dismiss'
  reviewedBy?: string
  reviewedAt?: string
  reversedAction?: 'unflag' | 'restore' | 'unsuspend'
  reversedAt?: string
  reversedBy?: string
  reversalNote?: string
}

// ── Boost ──────────────────────────────────────────────────
export type BoostStatus = 'active' | 'expired'

export interface Boost {
  id: string
  propertyId: string
  propertyTitle: string
  landlordId: string
  landlordName: string
  package: 'Bronze' | 'Silver' | 'Gold'
  amount: number
  startDate: string
  endDate: string
  status: BoostStatus
}

// ── Analytics ──────────────────────────────────────────────
export interface MonthlyStats {
  month: string
  listings: number
  users: number
  revenue: number
}

export interface DashboardStats {
  totalListings: number
  pendingVerification: number
  totalUsers: number
  activeLandlords: number
  openReports: number
  boostRevenue: number
  newListingsThisWeek: number
  newUsersThisWeek: number
}

// ── API responses ──────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
}

// ── Table pagination ───────────────────────────────────────
export interface PaginationMeta {
  page: number
  perPage: number
  total: number
  totalPages: number
}