import type {Citation} from './schemas';

/**
 * One valid citation of every kind. Used by the schema tests, the stories and
 * the component tests so all three exercise the same shapes.
 */
export const EXAMPLE_CITATIONS: Citation[] = [
  {
    id: 'c_issue01',
    kind: 'issue',
    title: 'JAVASCRIPT-22SP',
    excerpt: '903 users affected in the last 24h',
    projectId: '1',
    locator: {
      groupId: '7716642857',
      shortId: 'JAVASCRIPT-22SP',
      stat: {name: 'users', value: 903},
    },
  },
  {
    id: 'c_frame01',
    kind: 'event',
    title: 'submitOrder in checkout.ts',
    excerpt: "TypeError: Cannot read properties of undefined (reading 'total')",
    observedAt: '2026-08-25T16:37:12Z',
    projectId: '1',
    locator: {
      eventId: '8f2c1a9d7e6b4f30a1b2c3d4e5f60718',
      groupId: '7716642857',
      focus: {
        type: 'frame',
        exceptionIndex: 0,
        frameIndex: 4,
        function: 'submitOrder',
        filename: 'app/checkout.ts',
        lineNo: 88,
      },
    },
  },
  {
    id: 'c_tag01',
    kind: 'event',
    title: 'browser: Chrome 131',
    locator: {
      eventId: '8f2c1a9d7e6b4f30a1b2c3d4e5f60718',
      groupId: '7716642857',
      focus: {type: 'tag', key: 'browser', value: 'Chrome 131'},
    },
  },
  {
    id: 'c_span01',
    kind: 'trace',
    title: 'POST /api/checkout (2.4s)',
    observedAt: '2026-08-25T16:37:10Z',
    locator: {traceId: 'a1b2c3d4e5f678901234567890abcdef', spanId: 'b1c2d3e4f5a67890'},
  },
  {
    id: 'c_log01',
    kind: 'log',
    title: 'payment provider timeout',
    excerpt: 'stripe: request timed out after 10000ms',
    observedAt: '2026-08-25T16:37:11Z',
    projectId: '1',
    locator: {
      logId: '019bfe1c4c1f7e3d9a2f3e6b1a2c3d4e',
      traceId: 'a1b2c3d4e5f678901234567890abcdef',
      timestamp: '2026-08-25T16:37:11Z',
    },
  },
  {
    id: 'c_replay01',
    kind: 'replay',
    title: 'User rage-clicks "Pay now"',
    locator: {replayId: '4c1f2e3d123456789012345678901234', offsetMs: 42_000},
  },
  {
    id: 'c_profile01',
    kind: 'profile',
    title: 'serializeCart hot path',
    locator: {
      profileId: '7f3c2b1a9d8e4f60',
      projectSlug: 'javascript',
      function: 'serializeCart',
    },
  },
  {
    id: 'c_query01',
    kind: 'query',
    title: 'Affected users, last 24h',
    locator: {
      dataset: 'errors',
      query: 'issue:JAVASCRIPT-22SP',
      yAxes: ['count()', 'count_unique(user)'],
      statsPeriod: '24h',
      resultSummary: 'count()=4,112; count_unique(user)=903',
    },
  },
  {
    id: 'c_feedback01',
    kind: 'feedback',
    title: '"I can\'t pay for my order"',
    excerpt: "I can't pay for my order, the button does nothing.",
    projectId: '1',
    locator: {feedbackId: '0d1e2f3a4b5c6d7e8f90a1b2c3d4e5f6'},
  },
  {
    id: 'c_code01',
    kind: 'code',
    title: 'app/checkout.ts:80-95',
    excerpt: 'const total = order.summary.total;',
    url: 'https://github.com/example/shop/blob/abc1234/app/checkout.ts#L80-L95',
    locator: {
      repo: 'example/shop',
      path: 'app/checkout.ts',
      ref: 'abc1234',
      startLine: 80,
      endLine: 95,
    },
  },
  {
    id: 'c_commit01',
    kind: 'commit',
    title: 'Refactor order summary',
    url: 'https://github.com/example/shop/commit/abc1234',
    locator: {repo: 'example/shop', sha: 'abc1234'},
  },
  {
    id: 'c_pr01',
    kind: 'pullRequest',
    title: '#512 Move totals into summary',
    url: 'https://github.com/example/shop/pull/512',
    locator: {repo: 'example/shop', number: 512},
  },
  {
    id: 'c_docs01',
    kind: 'external',
    title: 'Stripe idempotency keys',
    url: 'https://docs.stripe.com/api/idempotent_requests',
    locator: {url: 'https://docs.stripe.com/api/idempotent_requests', source: 'docs'},
  },
];
