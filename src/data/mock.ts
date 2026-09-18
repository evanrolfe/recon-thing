import type {
  Action,
  ActionKind,
  CapturedRequest,
  ChangeCounts,
  Database,
  DiffEntry,
  Flow,
  FlowStatus,
  HttpMethod,
  Page,
  PageRun,
  Run,
  Scan,
  Target,
  Variant,
} from './types'

// ---------------------------------------------------------------------------
// Small deterministic helpers so the demo data is stable across reloads.
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000
// Anchor "now" so timestamps are stable and recent relative to the proposal.
const NOW = new Date('2026-09-17T02:00:00Z').getTime()

function isoDaysAgo(days: number, jitterMinutes = 0): string {
  return new Date(NOW - days * DAY + jitterMinutes * 60 * 1000).toISOString()
}

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'accept': 'application/json',
  }
}

function respHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra,
  }
}

function encodeBody(body: unknown): string | undefined {
  if (body === undefined) return undefined
  return typeof body === 'string' ? body : JSON.stringify(body, null, 2)
}

let reqCounter = 0
function req(
  method: HttpMethod,
  url: string,
  status: number,
  opts: {
    requestBody?: unknown
    responseBody?: unknown
    durationMs?: number
    responseHeaders?: Record<string, string>
  } = {},
): CapturedRequest {
  reqCounter += 1
  return {
    id: `req-${reqCounter}`,
    method,
    url,
    status,
    durationMs: opts.durationMs ?? 40 + ((reqCounter * 37) % 260),
    requestHeaders: method === 'GET' ? { accept: 'application/json' } : jsonHeaders(),
    requestBody: encodeBody(opts.requestBody),
    responseHeaders: opts.responseHeaders ?? respHeaders(),
    responseBody: encodeBody(opts.responseBody),
  }
}

// Page-load requests captured when the browser first navigates to the target
// URL. Always the first thing a run does, so flows are reproducible.
function makeLoadRequests(targetUrl: string): CapturedRequest[] {
  return [
    req('GET', `${targetUrl}/`, 200, {
      responseHeaders: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
      responseBody:
        '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/assets/app.js"></script>\n  </body>\n</html>',
    }),
    req('GET', '/api/v1/config', 200, {
      responseBody: { env: 'production', version: '2026.9.1', features: { betaCheckout: true } },
    }),
    req('GET', '/api/v1/session', 200, {
      responseBody: { authenticated: false, csrfToken: 'csrf_7f21' },
    }),
  ]
}

// ---------------------------------------------------------------------------
// Flow catalog: reusable behaviours a webapp might expose. Each target picks a
// subset. Each variant carries a template of captured requests.
// ---------------------------------------------------------------------------

interface VariantSeed {
  slug: string
  name: string
  description: string
  requests: CapturedRequest[]
}

interface FlowSeed {
  slug: string
  name: string
  description: string
  variants: VariantSeed[]
}

const FLOW_CATALOG: FlowSeed[] = [
  {
    slug: 'register-user',
    name: 'Register a user',
    description: 'Create a new account via the sign-up form.',
    variants: [
      {
        slug: 'new-email',
        name: 'With a new email',
        description: 'Registering with an email that is not already in use.',
        requests: [
          req('POST', '/api/v1/auth/register', 201, {
            requestBody: { email: 'jamie+new@example.com', password: '••••••••', name: 'Jamie' },
            responseBody: { id: 'usr_9f2', email: 'jamie+new@example.com', verified: false },
          }),
          req('POST', '/api/v1/auth/send-verification', 202, {
            requestBody: { userId: 'usr_9f2' },
            responseBody: { queued: true },
          }),
        ],
      },
      {
        slug: 'existing-email',
        name: 'With an already-registered email',
        description: 'Registering with an email that already exists.',
        requests: [
          req('POST', '/api/v1/auth/register', 409, {
            requestBody: { email: 'existing@example.com', password: '••••••••', name: 'Sam' },
            responseBody: { error: 'email_taken', message: 'That email is already registered.' },
          }),
        ],
      },
    ],
  },
  {
    slug: 'login',
    name: 'Log in',
    description: 'Authenticate an existing user.',
    variants: [
      {
        slug: 'valid-credentials',
        name: 'With valid credentials',
        description: 'Correct email and password.',
        requests: [
          req('POST', '/api/v1/auth/login', 200, {
            requestBody: { email: 'sam@example.com', password: '••••••••' },
            responseBody: { token: 'eyJhbGciOi...', expiresIn: 3600 },
          }),
          req('GET', '/api/v1/me', 200, {
            responseBody: { id: 'usr_1', name: 'Sam', roles: ['member'] },
          }),
        ],
      },
      {
        slug: 'wrong-password',
        name: 'With a wrong password',
        description: 'Correct email, incorrect password.',
        requests: [
          req('POST', '/api/v1/auth/login', 401, {
            requestBody: { email: 'sam@example.com', password: '••••••••' },
            responseBody: { error: 'invalid_credentials' },
          }),
        ],
      },
    ],
  },
  {
    slug: 'search',
    name: 'Search the catalog',
    description: 'Run a keyword search over products/content.',
    variants: [
      {
        slug: 'with-results',
        name: 'Query with results',
        description: 'A search term that returns matches.',
        requests: [
          req('GET', '/api/v1/search?q=jacket&page=1', 200, {
            responseBody: { total: 42, page: 1, results: [{ id: 'p_1', title: 'Rain Jacket' }] },
          }),
        ],
      },
      {
        slug: 'no-results',
        name: 'Query with no results',
        description: 'A search term that returns nothing.',
        requests: [
          req('GET', '/api/v1/search?q=zzxqq&page=1', 200, {
            responseBody: { total: 0, page: 1, results: [] },
          }),
        ],
      },
    ],
  },
  {
    slug: 'add-to-cart',
    name: 'Add an item to the cart',
    description: 'Add a product to the shopping cart.',
    variants: [
      {
        slug: 'in-stock',
        name: 'In-stock item',
        description: 'Adding an item that is available.',
        requests: [
          req('POST', '/api/v1/cart/items', 200, {
            requestBody: { productId: 'p_1', qty: 1 },
            responseBody: { cartId: 'cart_7', itemCount: 1, subtotal: 79.0 },
          }),
        ],
      },
      {
        slug: 'out-of-stock',
        name: 'Out-of-stock item',
        description: 'Adding an item that is sold out.',
        requests: [
          req('POST', '/api/v1/cart/items', 422, {
            requestBody: { productId: 'p_99', qty: 1 },
            responseBody: { error: 'out_of_stock', productId: 'p_99' },
          }),
        ],
      },
    ],
  },
  {
    slug: 'checkout',
    name: 'Purchase an item',
    description: 'Complete a checkout and payment.',
    variants: [
      {
        slug: 'card-success',
        name: 'With a valid card',
        description: 'Payment succeeds.',
        requests: [
          req('POST', '/api/v1/checkout', 200, {
            requestBody: { cartId: 'cart_7', paymentMethod: 'card_visa' },
            responseBody: { orderId: 'ord_44', status: 'paid', total: 79.0 },
          }),
          req('GET', '/api/v1/orders/ord_44', 200, {
            responseBody: { orderId: 'ord_44', status: 'paid' },
          }),
        ],
      },
      {
        slug: 'card-declined',
        name: 'With a declined card',
        description: 'Payment is declined by the processor.',
        requests: [
          req('POST', '/api/v1/checkout', 402, {
            requestBody: { cartId: 'cart_7', paymentMethod: 'card_declined' },
            responseBody: { error: 'card_declined', declineCode: 'insufficient_funds' },
          }),
        ],
      },
    ],
  },
  {
    slug: 'post-comment',
    name: 'Post a comment',
    description: 'Submit a comment on a piece of content.',
    variants: [
      {
        slug: 'valid',
        name: 'With valid content',
        description: 'A normal comment body.',
        requests: [
          req('POST', '/api/v1/posts/p_1/comments', 201, {
            requestBody: { body: 'Great write-up!' },
            responseBody: { id: 'cmt_5', body: 'Great write-up!', flagged: false },
          }),
        ],
      },
      {
        slug: 'flagged',
        name: 'With content that gets flagged',
        description: 'A comment that trips the moderation filter.',
        requests: [
          req('POST', '/api/v1/posts/p_1/comments', 202, {
            requestBody: { body: 'buy cheap watches http://spam.example' },
            responseBody: { id: 'cmt_6', flagged: true, reason: 'link_spam' },
          }),
        ],
      },
    ],
  },
  {
    slug: 'update-profile',
    name: 'Update profile',
    description: 'Edit the current user profile.',
    variants: [
      {
        slug: 'change-name',
        name: 'Change display name',
        description: 'Update the name field only.',
        requests: [
          req('PATCH', '/api/v1/me', 200, {
            requestBody: { name: 'Samantha' },
            responseBody: { id: 'usr_1', name: 'Samantha' },
          }),
        ],
      },
    ],
  },
  {
    slug: 'subscribe-newsletter',
    name: 'Subscribe to newsletter',
    description: 'Opt in to the marketing newsletter.',
    variants: [
      {
        slug: 'default',
        name: 'With a valid email',
        description: 'Standard opt-in.',
        requests: [
          req('POST', '/api/v1/newsletter/subscribe', 200, {
            requestBody: { email: 'reader@example.com' },
            responseBody: { subscribed: true },
          }),
        ],
      },
    ],
  },
  {
    slug: 'upload-avatar',
    name: 'Upload an avatar',
    description: 'Upload a profile picture.',
    variants: [
      {
        slug: 'valid-image',
        name: 'With a valid image',
        description: 'A supported image type under the size limit.',
        requests: [
          req('POST', '/api/v1/me/avatar', 201, {
            responseBody: { url: 'https://cdn.example/av/usr_1.png' },
          }),
        ],
      },
      {
        slug: 'too-large',
        name: 'With an oversized file',
        description: 'A file above the upload limit.',
        requests: [
          req('POST', '/api/v1/me/avatar', 413, {
            responseBody: { error: 'file_too_large', maxBytes: 2097152 },
          }),
        ],
      },
    ],
  },
  {
    slug: 'delete-account',
    name: 'Delete account',
    description: 'Permanently delete the current account.',
    variants: [
      {
        slug: 'confirmed',
        name: 'With confirmation',
        description: 'User confirms the destructive action.',
        requests: [
          req('DELETE', '/api/v1/me', 202, {
            requestBody: { confirm: true },
            responseBody: { scheduledDeletionAt: '2026-10-01T00:00:00Z' },
          }),
        ],
      },
    ],
  },
  {
    slug: 'apply-coupon',
    name: 'Apply a coupon',
    description: 'Apply a discount code at the cart.',
    variants: [
      {
        slug: 'valid-code',
        name: 'With a valid code',
        description: 'A code that is active.',
        requests: [
          req('POST', '/api/v1/cart/coupon', 200, {
            requestBody: { code: 'AUTUMN20' },
            responseBody: { applied: true, discountPct: 20 },
          }),
        ],
      },
      {
        slug: 'expired-code',
        name: 'With an expired code',
        description: 'A code that is no longer valid.',
        requests: [
          req('POST', '/api/v1/cart/coupon', 422, {
            requestBody: { code: 'SPRING10' },
            responseBody: { error: 'coupon_expired' },
          }),
        ],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Action steps: the ordered browser interactions the AI performs to execute a
// variant. Each step optionally lists the request URL(s) it triggers, so runs
// can link steps to their captured traffic. Keyed by "<flowSlug>/<variantSlug>".
// ---------------------------------------------------------------------------

interface ActionSeed {
  label: string
  kind: ActionKind
  /** Request URLs this step fires. Matched against the run's captured requests. */
  urls?: string[]
}

const ACTIONS_BY_VARIANT: Record<string, ActionSeed[]> = {
  'register-user/new-email': [
    { label: 'Open the sign-up page', kind: 'navigate' },
    { label: 'Fill in the registration form', kind: 'fill' },
    { label: 'Click "Create account"', kind: 'submit', urls: ['/api/v1/auth/register'] },
    { label: 'Trigger the verification email', kind: 'wait', urls: ['/api/v1/auth/send-verification'] },
  ],
  'register-user/existing-email': [
    { label: 'Open the sign-up page', kind: 'navigate' },
    { label: 'Fill in the registration form', kind: 'fill' },
    { label: 'Click "Create account"', kind: 'submit', urls: ['/api/v1/auth/register'] },
    { label: 'Read the "email taken" error', kind: 'wait' },
  ],
  'login/valid-credentials': [
    { label: 'Open the login page', kind: 'navigate' },
    { label: 'Fill in email and password', kind: 'fill' },
    { label: 'Click "Log in"', kind: 'submit', urls: ['/api/v1/auth/login'] },
    { label: 'Load the dashboard', kind: 'navigate', urls: ['/api/v1/me'] },
  ],
  'login/wrong-password': [
    { label: 'Open the login page', kind: 'navigate' },
    { label: 'Fill in email and password', kind: 'fill' },
    { label: 'Click "Log in"', kind: 'submit', urls: ['/api/v1/auth/login'] },
    { label: 'Read the "invalid credentials" error', kind: 'wait' },
  ],
  'search/with-results': [
    { label: 'Focus the search box', kind: 'click' },
    { label: 'Type "jacket"', kind: 'fill' },
    { label: 'Submit the search', kind: 'submit', urls: ['/api/v1/search?q=jacket&page=1'] },
  ],
  'search/no-results': [
    { label: 'Focus the search box', kind: 'click' },
    { label: 'Type "zzxqq"', kind: 'fill' },
    { label: 'Submit the search', kind: 'submit', urls: ['/api/v1/search?q=zzxqq&page=1'] },
  ],
  'add-to-cart/in-stock': [
    { label: 'Open a product page', kind: 'navigate' },
    { label: 'Select a size', kind: 'select' },
    { label: 'Click "Add to cart"', kind: 'click', urls: ['/api/v1/cart/items'] },
  ],
  'add-to-cart/out-of-stock': [
    { label: 'Open a sold-out product page', kind: 'navigate' },
    { label: 'Click "Add to cart"', kind: 'click', urls: ['/api/v1/cart/items'] },
    { label: 'Read the "out of stock" notice', kind: 'wait' },
  ],
  'checkout/card-success': [
    { label: 'Open the cart', kind: 'navigate' },
    { label: 'Click "Checkout"', kind: 'click' },
    { label: 'Fill in card details', kind: 'fill' },
    { label: 'Click "Pay now"', kind: 'submit', urls: ['/api/v1/checkout'] },
    { label: 'Load the confirmation page', kind: 'navigate', urls: ['/api/v1/orders/ord_44'] },
  ],
  'checkout/card-declined': [
    { label: 'Open the cart', kind: 'navigate' },
    { label: 'Fill in card details', kind: 'fill' },
    { label: 'Click "Pay now"', kind: 'submit', urls: ['/api/v1/checkout'] },
    { label: 'Read the "card declined" error', kind: 'wait' },
  ],
  'post-comment/valid': [
    { label: 'Open a post', kind: 'navigate' },
    { label: 'Write a comment', kind: 'fill' },
    {
      label: 'Click "Post"',
      kind: 'submit',
      urls: ['/api/v1/moderation/score', '/api/v1/posts/p_1/comments'],
    },
  ],
  'post-comment/flagged': [
    { label: 'Open a post', kind: 'navigate' },
    { label: 'Write a comment with a link', kind: 'fill' },
    { label: 'Click "Post"', kind: 'submit', urls: ['/api/v1/posts/p_1/comments'] },
  ],
  'update-profile/change-name': [
    { label: 'Open profile settings', kind: 'navigate' },
    { label: 'Edit the display name', kind: 'fill' },
    { label: 'Click "Save"', kind: 'submit', urls: ['/api/v1/me'] },
  ],
  'subscribe-newsletter/default': [
    { label: 'Enter email in the footer', kind: 'fill' },
    { label: 'Click "Subscribe"', kind: 'submit', urls: ['/api/v1/newsletter/subscribe'] },
  ],
  'upload-avatar/valid-image': [
    { label: 'Open profile settings', kind: 'navigate' },
    { label: 'Choose an image file', kind: 'select' },
    { label: 'Click "Upload"', kind: 'submit', urls: ['/api/v1/me/avatar'] },
  ],
  'upload-avatar/too-large': [
    { label: 'Open profile settings', kind: 'navigate' },
    { label: 'Choose an oversized file', kind: 'select' },
    { label: 'Click "Upload"', kind: 'submit', urls: ['/api/v1/me/avatar'] },
    { label: 'Read the "file too large" error', kind: 'wait' },
  ],
  'delete-account/confirmed': [
    { label: 'Open account settings', kind: 'navigate' },
    { label: 'Click "Delete account"', kind: 'click' },
    { label: 'Confirm in the modal', kind: 'confirm', urls: ['/api/v1/me'] },
  ],
  'apply-coupon/valid-code': [
    { label: 'Open the cart', kind: 'navigate' },
    { label: 'Enter the coupon code', kind: 'fill' },
    { label: 'Click "Apply"', kind: 'submit', urls: ['/api/v1/cart/coupon', '/api/v1/cart'] },
  ],
  'apply-coupon/expired-code': [
    { label: 'Open the cart', kind: 'navigate' },
    { label: 'Enter the coupon code', kind: 'fill' },
    { label: 'Click "Apply"', kind: 'submit', urls: ['/api/v1/cart/coupon'] },
    { label: 'Read the "coupon expired" error', kind: 'wait' },
  ],
}

// Concise summaries shown on the flow view, keyed by "<flowSlug>/<variantSlug>".
const SUMMARIES_BY_VARIANT: Record<string, { summary: string; outcome: string }> = {
  'register-user/new-email': {
    summary:
      'Opens the sign-up page, fills the form with a fresh email address, and submits it to create a brand-new account.',
    outcome:
      'The account is created (201) and a verification email is queued. No session is issued until the email is confirmed.',
  },
  'register-user/existing-email': {
    summary:
      'Submits the sign-up form using an email address that already belongs to an account.',
    outcome:
      'Registration is rejected with 409 Conflict and an "email_taken" error. No new account is created.',
  },
  'login/valid-credentials': {
    summary: 'Enters a known email and correct password and submits the login form.',
    outcome:
      'Authentication succeeds (200), a session token is returned, and the dashboard loads the current user.',
  },
  'login/wrong-password': {
    summary: 'Enters a valid email with an incorrect password and submits the form.',
    outcome:
      'Login fails with 401 Unauthorized and an "invalid_credentials" error. No token is issued.',
  },
  'search/with-results': {
    summary: 'Types a common keyword into the search box and submits the query.',
    outcome: 'The API returns 200 with a populated result set and total count for the query.',
  },
  'search/no-results': {
    summary: 'Searches for a nonsense term unlikely to match any content.',
    outcome: 'The API returns 200 with an empty result set and a total of zero.',
  },
  'add-to-cart/in-stock': {
    summary: 'Opens a product page, picks a variant, and adds an available item to the cart.',
    outcome: 'The item is added (200) and the cart subtotal and item count are updated.',
  },
  'add-to-cart/out-of-stock': {
    summary: 'Attempts to add a product that is currently sold out.',
    outcome: 'The request is rejected with 422 and an "out_of_stock" error; the cart is unchanged.',
  },
  'checkout/card-success': {
    summary:
      'Opens the cart, proceeds to checkout, enters valid card details, and confirms payment.',
    outcome: 'Payment succeeds (200), an order is created and marked paid, and the confirmation loads.',
  },
  'checkout/card-declined': {
    summary: 'Completes checkout using a card that the processor will decline.',
    outcome:
      'Payment fails with 402 and a "card_declined" decline code. No order is created.',
  },
  'post-comment/valid': {
    summary: 'Opens a post, writes an ordinary comment, and submits it.',
    outcome: 'The comment is created (201) and is not flagged by moderation.',
  },
  'post-comment/flagged': {
    summary: 'Submits a comment containing a spam-like link.',
    outcome:
      'The comment is accepted for review (202) and flagged by moderation with a "link_spam" reason.',
  },
  'update-profile/change-name': {
    summary: 'Opens profile settings, edits the display name, and saves the change.',
    outcome: 'The profile is updated (200) and the response echoes the new name.',
  },
  'subscribe-newsletter/default': {
    summary: 'Enters an email in the footer form and opts in to the newsletter.',
    outcome: 'The subscription succeeds (200) and the address is marked subscribed.',
  },
  'upload-avatar/valid-image': {
    summary: 'Opens profile settings, selects a valid image, and uploads it.',
    outcome: 'The upload succeeds (201) and a CDN URL for the new avatar is returned.',
  },
  'upload-avatar/too-large': {
    summary: 'Tries to upload an image larger than the allowed size limit.',
    outcome: 'The upload is rejected with 413 and a "file_too_large" error stating the max size.',
  },
  'delete-account/confirmed': {
    summary:
      'Opens account settings, requests deletion, and confirms the destructive action in the modal.',
    outcome: 'Deletion is accepted (202) and scheduled for a future date rather than applied immediately.',
  },
  'apply-coupon/valid-code': {
    summary: 'Enters an active discount code at the cart and applies it.',
    outcome: 'The coupon is applied (200) and the discount percentage is reflected in the cart.',
  },
  'apply-coupon/expired-code': {
    summary: 'Enters a discount code that is no longer valid.',
    outcome: 'The coupon is rejected with 422 and a "coupon_expired" error; the total is unchanged.',
  },
}

// Frontend page paths discovered during the crawl phase, per flow slug. Plus a
// set of common pages every crawl finds.
const COMMON_PAGES = ['/', '/about', '/pricing', '/contact', '/help', '/terms', '/privacy']

const PAGES_BY_FLOW: Record<string, string[]> = {
  'register-user': ['/signup', '/verify-email'],
  login: ['/login', '/forgot-password'],
  search: ['/search'],
  'add-to-cart': ['/products', '/products/rain-jacket', '/products/trail-runner'],
  checkout: ['/cart', '/checkout', '/checkout/confirmation'],
  'apply-coupon': ['/cart'],
  'post-comment': ['/posts', '/posts/getting-started', '/posts/2026-roadmap'],
  'update-profile': ['/account', '/account/settings'],
  'subscribe-newsletter': ['/'],
  'upload-avatar': ['/account/settings'],
  'delete-account': ['/account/settings', '/account/delete'],
}

function pagesForFlows(flowSlugs: string[]): string[] {
  const set = new Set<string>(COMMON_PAGES)
  for (const slug of flowSlugs) for (const p of PAGES_BY_FLOW[slug] ?? []) set.add(p)
  return [...set].sort()
}

// API calls a given page makes when crawled (beyond the shared page-load calls).
const PAGE_API_BY_PATH: Record<string, () => CapturedRequest[]> = {
  '/search': () => [
    req('GET', '/api/v1/search?q=&page=1', 200, { responseBody: { total: 0, results: [] } }),
  ],
  '/products': () => [
    req('GET', '/api/v1/products?page=1', 200, {
      responseBody: { total: 128, page: 1, items: [{ id: 'p_1', title: 'Rain Jacket' }] },
    }),
  ],
  '/products/rain-jacket': () => [
    req('GET', '/api/v1/products/p_1', 200, { responseBody: { id: 'p_1', title: 'Rain Jacket', price: 79 } }),
    req('GET', '/api/v1/products/p_1/reviews', 200, { responseBody: { total: 24, average: 4.6 } }),
  ],
  '/products/trail-runner': () => [
    req('GET', '/api/v1/products/p_2', 200, { responseBody: { id: 'p_2', title: 'Trail Runner', price: 119 } }),
  ],
  '/cart': () => [
    req('GET', '/api/v1/cart', 200, { responseBody: { itemCount: 1, subtotal: 79 } }),
  ],
  '/checkout': () => [
    req('GET', '/api/v1/cart', 200, { responseBody: { itemCount: 1, subtotal: 79 } }),
    req('GET', '/api/v1/shipping/options', 200, { responseBody: { options: ['standard', 'express'] } }),
  ],
  '/account': () => [req('GET', '/api/v1/me', 200, { responseBody: { id: 'usr_1', name: 'Sam' } })],
  '/account/settings': () => [
    req('GET', '/api/v1/me', 200, { responseBody: { id: 'usr_1', name: 'Sam' } }),
    req('GET', '/api/v1/me/preferences', 200, { responseBody: { theme: 'dark', emails: true } }),
  ],
  '/posts': () => [
    req('GET', '/api/v1/posts?page=1', 200, { responseBody: { total: 57, items: [{ id: 'p_1' }] } }),
  ],
  '/posts/getting-started': () => [
    req('GET', '/api/v1/posts/p_1', 200, { responseBody: { id: 'p_1', title: 'Getting started' } }),
    req('GET', '/api/v1/posts/p_1/comments', 200, { responseBody: { total: 5 } }),
  ],
  '/pricing': () => [req('GET', '/api/v1/plans', 200, { responseBody: { plans: ['free', 'pro'] } })],
}

/** Turn a page path into a URL-safe id segment. */
function pageSlug(path: string): string {
  if (path === '/') return 'home'
  return path.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '-')
}

/** Deterministic hash so the same path always gets the same status. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function pageStatus(targetSlug: string, path: string): FlowStatus {
  const h = hashString(`${targetSlug}:${path}`) % 10
  if (h === 0) return 'new'
  if (h === 1) return 'removed'
  if (h <= 3) return 'changed'
  return 'unchanged'
}

function pageRequests(path: string, targetUrl: string): CapturedRequest[] {
  const extra = PAGE_API_BY_PATH[path]?.() ?? []
  return [...makeLoadRequests(targetUrl), ...extra]
}

// Introduce a behavioural change on a "changed" page's latest run.
function applyPageChange(requests: CapturedRequest[]): CapturedRequest[] {
  const clone = requests.map((r) => ({ ...r }))
  const config = clone.find((r) => r.url === '/api/v1/config')
  if (config) {
    config.responseBody = JSON.stringify(
      { env: 'production', version: '2026.9.2', features: { betaCheckout: true, newNav: true } },
      null,
      2,
    )
  }
  // A new analytics endpoint is now called on load.
  clone.push(
    req('GET', '/api/v1/experiments', 200, { responseBody: { assigned: ['exp_checkout_v2'] } }),
  )
  return clone
}

function buildActions(
  variantId: string,
  scanId: string,
  key: string,
  requests: CapturedRequest[],
): Action[] {
  const seeds = ACTIONS_BY_VARIANT[key] ?? []
  return seeds.map((seed, i) => ({
    id: `${variantId}__${scanId}__a${i + 1}`,
    label: seed.label,
    kind: seed.kind,
    requestIds: (seed.urls ?? []).flatMap((u) =>
      requests.filter((r) => r.url === u).map((r) => r.id),
    ),
  }))
}

// ---------------------------------------------------------------------------
// Target definitions: which flows each tracked webapp exposes, and which of
// those flows are new / changed / removed as of the latest scan.
// ---------------------------------------------------------------------------

interface TargetSeed {
  slug: string
  name: string
  url: string
  tags: string[]
  createdDaysAgo: number
  scanCount: number
  flowSlugs: string[]
  newFlows: string[]
  changedFlows: string[]
  removedFlows: string[]
  /** Limit a flow to its most recent N scans (i.e. N runs) instead of all scans. */
  flowRunCounts?: Record<string, number>
}

const TARGET_SEEDS: TargetSeed[] = [
  {
    slug: 'shopwave',
    name: 'ShopWave Storefront',
    url: 'https://shop.shopwave.io',
    tags: ['ecommerce', 'production', 'stripe'],
    createdDaysAgo: 120,
    scanCount: 8,
    flowSlugs: [
      'register-user', 'login', 'search', 'add-to-cart', 'checkout',
      'apply-coupon', 'update-profile', 'subscribe-newsletter', 'upload-avatar',
    ],
    newFlows: [],
    changedFlows: ['checkout', 'add-to-cart', 'apply-coupon'],
    removedFlows: ['upload-avatar'],
    // apply-coupon was introduced recently: only its 4 most recent runs exist.
    flowRunCounts: { 'apply-coupon': 4 },
  },
  {
    slug: 'inkwell',
    name: 'Inkwell Blog Platform',
    url: 'https://app.inkwell.blog',
    tags: ['content', 'production'],
    createdDaysAgo: 86,
    scanCount: 7,
    flowSlugs: [
      'register-user', 'login', 'search', 'post-comment', 'update-profile',
      'subscribe-newsletter', 'upload-avatar', 'delete-account',
    ],
    newFlows: [],
    changedFlows: ['post-comment'],
    removedFlows: [],
  },
  {
    slug: 'ledgerly',
    name: 'Ledgerly Finance API',
    url: 'https://dashboard.ledgerly.com',
    tags: ['fintech', 'production', 'pci'],
    createdDaysAgo: 200,
    scanCount: 8,
    flowSlugs: [
      'register-user', 'login', 'update-profile', 'delete-account', 'search',
    ],
    newFlows: ['delete-account'],
    changedFlows: ['login'],
    removedFlows: [],
  },
  {
    slug: 'trekmate',
    name: 'TrekMate Booking',
    url: 'https://book.trekmate.travel',
    tags: ['travel', 'staging'],
    createdDaysAgo: 45,
    scanCount: 6,
    flowSlugs: [
      'register-user', 'login', 'search', 'add-to-cart', 'checkout',
      'subscribe-newsletter',
    ],
    newFlows: ['subscribe-newsletter'],
    changedFlows: ['search'],
    removedFlows: ['add-to-cart'],
  },
  {
    slug: 'pulsehr',
    name: 'PulseHR Admin',
    url: 'https://admin.pulsehr.app',
    tags: ['saas', 'internal', 'production'],
    createdDaysAgo: 150,
    scanCount: 8,
    flowSlugs: [
      'login', 'update-profile', 'upload-avatar', 'delete-account', 'search',
    ],
    newFlows: [],
    changedFlows: ['update-profile'],
    removedFlows: [],
  },
  {
    slug: 'boltpay',
    name: 'BoltPay Checkout',
    url: 'https://pay.boltpay.dev',
    tags: ['fintech', 'staging', 'stripe'],
    createdDaysAgo: 30,
    scanCount: 6,
    flowSlugs: [
      'login', 'add-to-cart', 'apply-coupon', 'checkout', 'update-profile',
    ],
    newFlows: ['apply-coupon', 'update-profile'],
    changedFlows: ['checkout'],
    removedFlows: [],
  },
  {
    slug: 'chatterbox',
    name: 'Chatterbox Community',
    url: 'https://chatterbox.social',
    tags: ['social', 'production'],
    createdDaysAgo: 95,
    scanCount: 7,
    flowSlugs: [
      'register-user', 'login', 'post-comment', 'search', 'update-profile',
      'upload-avatar', 'delete-account', 'subscribe-newsletter',
    ],
    newFlows: [],
    changedFlows: ['register-user', 'post-comment'],
    removedFlows: ['subscribe-newsletter'],
  },
]

// ---------------------------------------------------------------------------
// Diff templates keyed by flow slug — the behaviour changes surfaced on the
// latest scan for "changed" flows. Also used to mutate the latest run's traffic.
// ---------------------------------------------------------------------------

const DIFFS_BY_FLOW: Record<string, DiffEntry[]> = {
  checkout: [
    {
      kind: 'added-property',
      location: 'POST /api/v1/checkout → request.body',
      after: '"idempotencyKey": "idem_a1b2"',
    },
    {
      kind: 'added-property',
      location: 'POST /api/v1/checkout → response.body',
      after: '"receiptUrl": "https://pay.example/r/ord_44"',
    },
  ],
  'add-to-cart': [
    {
      kind: 'changed-status',
      location: 'POST /api/v1/cart/items',
      before: '200 OK',
      after: '201 Created',
    },
  ],
  'post-comment': [
    {
      kind: 'new-endpoint',
      location: 'POST /api/v1/moderation/score',
      after: 'called before comment is persisted',
    },
    {
      kind: 'added-property',
      location: 'POST /api/v1/posts/p_1/comments → response.body',
      after: '"moderationScore": 0.02',
    },
  ],
  login: [
    {
      kind: 'added-property',
      location: 'POST /api/v1/auth/login → response.body',
      after: '"refreshToken": "rt_88c1"',
    },
    {
      kind: 'changed-value',
      location: 'POST /api/v1/auth/login → response.body.expiresIn',
      before: '3600',
      after: '900',
    },
  ],
  search: [
    {
      kind: 'removed-endpoint',
      location: 'GET /api/v1/search/suggest',
      before: 'typeahead suggestions were fetched on each keystroke',
    },
    {
      kind: 'added-property',
      location: 'GET /api/v1/search → response.body',
      after: '"facets": { "category": [...] }',
    },
  ],
  'register-user': [
    {
      kind: 'added-property',
      location: 'POST /api/v1/auth/register → request.body',
      after: '"captchaToken": "cf_9931"',
    },
  ],
  'update-profile': [
    {
      kind: 'changed-value',
      location: 'PATCH /api/v1/me → response.headers.cache-control',
      before: 'no-store',
      after: 'private, max-age=0',
    },
  ],
}

// Apply a flow's diff to a run's captured requests so the captured traffic and
// the diff are consistent (added props actually appear in the latest run's bodies).
function applyDiffToRequests(flowSlug: string, requests: CapturedRequest[]): CapturedRequest[] {
  const clone = requests.map((r) => ({ ...r }))
  switch (flowSlug) {
    case 'checkout': {
      const post = clone.find((r) => r.url === '/api/v1/checkout')
      if (post) {
        post.requestBody = JSON.stringify(
          { cartId: 'cart_7', paymentMethod: 'card_visa', idempotencyKey: 'idem_a1b2' },
          null,
          2,
        )
        post.responseBody = JSON.stringify(
          { orderId: 'ord_44', status: 'paid', total: 79.0, receiptUrl: 'https://pay.example/r/ord_44' },
          null,
          2,
        )
      }
      break
    }
    case 'add-to-cart': {
      const post = clone.find((r) => r.url === '/api/v1/cart/items')
      if (post) post.status = 201
      break
    }
    case 'login': {
      const post = clone.find((r) => r.url === '/api/v1/auth/login')
      if (post) {
        post.responseBody = JSON.stringify(
          { token: 'eyJhbGciOi...', refreshToken: 'rt_88c1', expiresIn: 900 },
          null,
          2,
        )
      }
      break
    }
    case 'register-user': {
      const post = clone.find((r) => r.url === '/api/v1/auth/register')
      if (post && post.status === 201) {
        post.requestBody = JSON.stringify(
          { email: 'jamie+new@example.com', password: '••••••••', name: 'Jamie', captchaToken: 'cf_9931' },
          null,
          2,
        )
      }
      break
    }
    case 'post-comment': {
      clone.unshift(
        req('POST', '/api/v1/moderation/score', 200, {
          requestBody: { body: 'Great write-up!' },
          responseBody: { score: 0.02, action: 'allow' },
        }),
      )
      break
    }
    case 'apply-coupon': {
      const post = clone.find((r) => r.url === '/api/v1/cart/coupon')
      if (post) {
        // The discount changed and a new field was added to the response.
        post.responseBody = JSON.stringify(
          { applied: true, discountPct: 25, discountAmount: 15.8 },
          null,
          2,
        )
      }
      // A new endpoint is now called to recalculate the cart after applying.
      clone.push(
        req('GET', '/api/v1/cart', 200, {
          responseBody: { subtotal: 79.0, discount: 15.8, total: 63.2, itemCount: 1 },
        }),
      )
      break
    }
    default:
      break
  }
  return clone
}

// ---------------------------------------------------------------------------
// Build the full database from the seeds.
// ---------------------------------------------------------------------------

function countsFromStatuses(statuses: FlowStatus[]): ChangeCounts {
  return {
    new: statuses.filter((s) => s === 'new').length,
    changed: statuses.filter((s) => s === 'changed').length,
    removed: statuses.filter((s) => s === 'removed').length,
  }
}

function buildDatabase(): Database {
  const targets: Target[] = []
  const scans: Scan[] = []
  const flows: Flow[] = []
  const variants: Variant[] = []
  const runs: Run[] = []
  const pages: Page[] = []
  const pageRuns: PageRun[] = []

  for (const seed of TARGET_SEEDS) {
    const targetId = `t-${seed.slug}`

    // Scans, newest last. Index 0 is oldest; last is the most recent.
    const targetScans: Scan[] = []
    for (let i = 0; i < seed.scanCount; i += 1) {
      const daysAgo = (seed.scanCount - 1 - i) // 0 == most recent
      const scanId = `${targetId}-s${i + 1}`
      targetScans.push({
        id: scanId,
        targetId,
        startedAt: isoDaysAgo(daysAgo, -18),
        completedAt: isoDaysAgo(daysAgo, 0),
        status: 'completed',
        flowCount: seed.flowSlugs.length,
        changeCounts: { new: 0, changed: 0, removed: 0 }, // filled below
      })
    }
    const latestScan = targetScans[targetScans.length - 1]
    const prevScan = targetScans[targetScans.length - 2]

    const flowStatuses: FlowStatus[] = []

    for (const flowSlug of seed.flowSlugs) {
      const template = FLOW_CATALOG.find((f) => f.slug === flowSlug)
      if (!template) continue
      const flowId = `${targetId}-f-${flowSlug}`

      let status: FlowStatus = 'unchanged'
      if (seed.newFlows.includes(flowSlug)) status = 'new'
      else if (seed.changedFlows.includes(flowSlug)) status = 'changed'
      else if (seed.removedFlows.includes(flowSlug)) status = 'removed'
      flowStatuses.push(status)

      const variantIds: string[] = []
      for (let vi = 0; vi < template.variants.length; vi += 1) {
        const vseed = template.variants[vi]
        const variantId = `${flowId}-v-${vseed.slug}`
        variantIds.push(variantId)

        const runIds: string[] = []
        // Optionally limit this flow to its most recent N scans.
        const runCount = seed.flowRunCounts?.[flowSlug]
        const startIndex = runCount != null ? Math.max(0, targetScans.length - runCount) : 0
        for (let si = 0; si < targetScans.length; si += 1) {
          const scan = targetScans[si]
          const isLatest = scan.id === latestScan.id
          if (si < startIndex) continue
          // "new" flows only have a run in the latest scan.
          if (status === 'new' && !isLatest) continue
          // "removed" flows have runs everywhere except the latest scan.
          if (status === 'removed' && isLatest) continue

          const runId = `${variantId}__${scan.id}`
          runIds.push(runId)

          const applyChange = status === 'changed' && isLatest && vi === 0
          const baseRequests = applyChange
            ? applyDiffToRequests(flowSlug, vseed.requests)
            : vseed.requests.map((r) => ({ ...r }))
          const diff = applyChange ? DIFFS_BY_FLOW[flowSlug] ?? [] : []

          // Every run starts by loading the target URL, so flows are reproducible.
          const loadReqs = makeLoadRequests(seed.url)
          const requests = [...loadReqs, ...baseRequests]
          const loadAction: Action = {
            id: `${variantId}__${scan.id}__a0`,
            label: `Load ${seed.url}`,
            kind: 'navigate',
            requestIds: loadReqs.map((r) => r.id),
          }
          const actions = [
            loadAction,
            ...buildActions(variantId, scan.id, `${flowSlug}/${vseed.slug}`, baseRequests),
          ]

          runs.push({
            id: runId,
            variantId,
            scanId: scan.id,
            timestamp: scan.completedAt,
            actions,
            requests,
            diff,
          })
        }

        const summaryInfo = SUMMARIES_BY_VARIANT[`${flowSlug}/${vseed.slug}`]
        variants.push({
          id: variantId,
          flowId,
          name: vseed.name,
          description: vseed.description,
          summary: summaryInfo?.summary ?? vseed.description,
          outcome: summaryInfo?.outcome ?? '',
          runIds,
        })
      }

      flows.push({
        id: flowId,
        targetId,
        name: template.name,
        description: template.description,
        status,
        variantIds,
      })
    }

    const latestCounts = countsFromStatuses(flowStatuses)
    latestScan.changeCounts = latestCounts
    // Give earlier scans some lighter, plausible activity for the trend chart.
    for (let i = 0; i < targetScans.length - 1; i += 1) {
      const s = targetScans[i]
      s.changeCounts = {
        new: i === 0 ? seed.flowSlugs.length : (i * 3) % 3,
        changed: (i * 2 + seed.slug.length) % 4,
        removed: i % 5 === 0 ? 0 : (i % 2),
      }
    }
    if (prevScan) {
      prevScan.changeCounts = {
        new: Math.max(0, latestCounts.new - 1),
        changed: Math.max(1, latestCounts.changed),
        removed: latestCounts.removed,
      }
    }

    scans.push(...targetScans)

    // Crawled pages, each with a run (captured traffic) per scan.
    const crawledPaths = pagesForFlows(seed.flowSlugs)
    for (const path of crawledPaths) {
      const pageId = `${targetId}-p-${pageSlug(path)}`
      const status = pageStatus(seed.slug, path)
      const runIds: string[] = []

      for (let si = 0; si < targetScans.length; si += 1) {
        const scan = targetScans[si]
        const isLatest = scan.id === latestScan.id
        if (status === 'new' && !isLatest) continue
        if (status === 'removed' && isLatest) continue

        const base = pageRequests(path, seed.url)
        const requests = status === 'changed' && isLatest ? applyPageChange(base) : base
        const runId = `${pageId}__${scan.id}`
        runIds.push(runId)
        pageRuns.push({ id: runId, pageId, scanId: scan.id, timestamp: scan.completedAt, requests })
      }

      const latestRun = pageRuns.find((r) => r.id === runIds[runIds.length - 1])
      pages.push({
        id: pageId,
        targetId,
        path,
        status,
        apiRequestCount: latestRun?.requests.length ?? 0,
        runIds,
      })
    }

    targets.push({
      id: targetId,
      name: seed.name,
      url: seed.url,
      tags: seed.tags,
      createdAt: isoDaysAgo(seed.createdDaysAgo),
      lastScanAt: latestScan.completedAt,
      stats: latestCounts,
      scanIds: targetScans.map((s) => s.id),
      pagesCrawled: crawledPaths,
    })
  }

  return { targets, scans, flows, variants, runs, pages, pageRuns }
}

export const db: Database = buildDatabase()
