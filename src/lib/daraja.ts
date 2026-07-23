import axios from 'axios'

// ── Daraja base URLs ───────────────────────────────────────
const IS_PROD    = process.env.MPESA_ENV === 'production'
const BASE_URL   = IS_PROD
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke'

const SHORTCODE         = process.env.MPESA_SHORTCODE!
const CONSUMER_KEY      = process.env.MPESA_CONSUMER_KEY!
const CONSUMER_SECRET   = process.env.MPESA_CONSUMER_SECRET!
const PASSKEY           = process.env.MPESA_PASSKEY!
const CALLBACK_URL      = process.env.MPESA_CALLBACK_URL!

// ── Token cache ────────────────────────────────────────────
interface TokenCache {
  token:     string
  expiresAt: number
}
let _cache: TokenCache | null = null

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (_cache && Date.now() < _cache.expiresAt - 60_000) {
    return _cache.token
  }

  const credentials = Buffer.from(
    `${CONSUMER_KEY}:${CONSUMER_SECRET}`
  ).toString('base64')

  const res = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  )

  const expiresIn = parseInt(res.data.expires_in ?? '3599', 10)
  _cache = {
    token:     res.data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  }

  return _cache.token
}

// ── Build timestamp + password ─────────────────────────────
function buildAuth() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14) // YYYYMMDDHHmmss

  const password = Buffer.from(
    `${SHORTCODE}${PASSKEY}${timestamp}`
  ).toString('base64')

  return { timestamp, password }
}

// ── STK Push ───────────────────────────────────────────────
export interface StkPushParams {
  phone:        string  // 2547XXXXXXXX
  amount:       number  // KSh integer
  accountRef:   string  // e.g. "BOOST-L001"
  description:  string  // e.g. "Bronze Boost 7 days"
}

export interface StkPushResponse {
  merchantRequestId:  string
  checkoutRequestId:  string
  responseCode:       string
  responseDescription: string
  customerMessage:    string
}

export async function stkPush(params: StkPushParams): Promise<StkPushResponse> {
  const token             = await getAccessToken()
  const { timestamp, password } = buildAuth()

  const body = {
    BusinessShortCode: SHORTCODE,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            Math.ceil(params.amount),       // must be integer
    PartyA:            params.phone,                   // payer phone
    PartyB:            SHORTCODE,                      // your shortcode
    PhoneNumber:       params.phone,                   // prompt recipient
    CallBackURL:       CALLBACK_URL,
    AccountReference:  params.accountRef.slice(0, 12), // max 12 chars
    TransactionDesc:   params.description.slice(0, 13),// max 13 chars
  }

  const res = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    body,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (res.data.ResponseCode !== '0') {
    throw new DarajaError(
      res.data.ResponseCode,
      res.data.ResponseDescription ?? 'STK push failed',
    )
  }

  return {
    merchantRequestId:   res.data.MerchantRequestID,
    checkoutRequestId:   res.data.CheckoutRequestID,
    responseCode:        res.data.ResponseCode,
    responseDescription: res.data.ResponseDescription,
    customerMessage:     res.data.CustomerMessage,
  }
}

// ── STK Query (poll status) ────────────────────────────────
export interface StkQueryResult {
  resultCode:        number
  resultDesc:        string
  merchantRequestId: string
  checkoutRequestId: string
}

export async function stkQuery(
  checkoutRequestId: string
): Promise<StkQueryResult> {
  const token             = await getAccessToken()
  const { timestamp, password } = buildAuth()

  const res = await axios.post(
    `${BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: SHORTCODE,
      Password:          password,
      Timestamp:         timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return {
    resultCode:        parseInt(res.data.ResultCode ?? '1', 10),
    resultDesc:        res.data.ResultDesc ?? 'Unknown',
    merchantRequestId: res.data.MerchantRequestID,
    checkoutRequestId: res.data.CheckoutRequestID,
  }
}

// ── Error class ────────────────────────────────────────────
export class DarajaError extends Error {
  constructor(
    public code:    string,
    public message: string,
  ) {
    super(message)
    this.name = 'DarajaError'
  }
}
