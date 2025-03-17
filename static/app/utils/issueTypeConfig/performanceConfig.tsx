import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const performanceConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {enabled: true},
      share: {enabled: true},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: false},
      checkIns: {enabled: false},
      uptimeChecks: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: true},
      tagsTab: {enabled: true},
    },
    autofix: false,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    stacktrace: {enabled: false},
    spanEvidence: {enabled: true},
    // Performance issues render a custom SpanEvidence component
    evidence: null,
    usesIssuePlatform: true,
    issueSummary: {enabled: false},
  },
  [IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: {
    resources: {
      description: t(
        'Consecutive DB Queries are a sequence of database spans where one or more have been identified as parallelizable, or in other words, spans that may be shifted to the start of the sequence. This often occurs when a db query performs no filtering on the data, for example a query without a WHERE clause. To learn more about how to fix consecutive DB queries, check out these resources:'
      ),
      links: [
        {
          text: t('Sentry Docs: Consecutive DB Queries'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/consecutive-db-queries/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_CONSECUTIVE_HTTP]: {
    resources: {
      description: t(
        'A Consecutive HTTP issue occurs when at least 2000ms of time can be saved by parallelizing at least 3 consecutive HTTP calls occur sequentially.'
      ),
      links: [
        {
          text: t('Sentry Docs: Consecutive HTTP'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/consecutive-http/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD]: {
    resources: {
      description: t('File IO operations on your main thread may lead to app hangs.'),
      links: [
        {
          text: t('Sentry Docs: File IO on the Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/file-main-thread-io/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_DB_MAIN_THREAD]: {
    resources: {
      description: t('Database operations on your main thread may lead to app hangs.'),
      links: [
        {
          text: t('Sentry Docs: Database on the Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/db-main-thread-io/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS]: {
    resources: {
      description: t(
        'N+1 API Calls are repeated concurrent calls to fetch a resource. These spans will always begin at the same time and may potentially be combined to fetch everything at once to reduce server load. Alternatively, you may be able to lazily load the resources. To learn more about how and when to fix N+1 API Calls, check out these resources:'
      ),
      links: [
        {
          text: t('Sentry Docs: N+1 API Calls'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/n-one-api-calls/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
    resources: {
      description: t(
        "N+1 queries are extraneous queries (N) caused by a single, initial query (+1). In the Span Evidence above, we've identified the parent span where the extraneous spans are located and the extraneous spans themselves. To learn more about how to fix N+1 problems, check out these resources:"
      ),
      links: [
        {
          text: t('Sentry Docs: N+1 Queries'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/n-one-queries/',
        },
      ],
      linksByPlatform: {
        python: [
          {
            text: t('Finding and Fixing Django N+1 Problems'),
            link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
          },
        ],
        'python-django': [
          {
            text: t('Finding and Fixing Django N+1 Problems'),
            link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
          },
        ],
      },
    },
  },
  [IssueType.PERFORMANCE_HTTP_OVERHEAD]: {
    resources: {
      description: t(
        "HTTP/1.1 can cause overhead, with long request queue times in the browser due to max connection limits. In the Span Evidence above, we've identified the extent of the wait time and spans affected by request queueing. To learn more about how to fix HTTP Overhead, check out these resources:"
      ),
      links: [
        {
          text: t('Sentry Docs: HTTP/1.1 Overhead'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/http-overhead/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET]: {
    resources: {
      description: t(
        'Large render blocking assets are a type of resource span delaying First Contentful Paint (FCP). Delaying FCP means it takes more time to initially load the page for the user. Spans that end after FCP are not as critical as those that end before it. The resource span may take form of a script, stylesheet, image, or other asset that requires optimization. To learn more about how to fix large render blocking assets, check out these resources:'
      ),
      links: [
        {
          text: t('Web Vital: First Contentful Paint'),
          link: 'https://web.dev/fcp/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_SLOW_DB_QUERY]: {
    resources: {
      description: t(
        'Slow DB Queries are SELECT query spans that are consistently taking longer than 500ms. A quick method to understand why this may be the case is running an EXPLAIN command on the query itself. To learn more about how to fix slow DB queries, check out these resources:'
      ),
      links: [
        {
          text: t('Sentry Docs: Slow DB Queries'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/slow-db-queries/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD]: {
    resources: {
      description: t(
        'A Large HTTP Payload issue occurs when an http payload size consistently exceeds a threshold of 300KB'
      ),
      links: [
        {
          text: t('Sentry Docs: Large HTTP Payload'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/large-http-payload/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_UNCOMPRESSED_ASSET]: {
    resources: {
      description: t(
        'Uncompressed assets are asset spans that take over 300ms and are larger than 512kB which can usually be made faster with compression. Check that your server or CDN serving your assets is accepting the content encoding header from the browser and is returning them compressed.'
      ),
      links: [],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_DURATION_REGRESSION]: {
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: false},
      checkIns: {enabled: false},
      uptimeChecks: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    discover: {enabled: false},
    regression: {enabled: true},
    performanceDurationRegression: {enabled: true},
    stats: {enabled: false},
    tags: {enabled: false},
    // We show the regression summary instead
    spanEvidence: {enabled: false},
  },
  [IssueType.PERFORMANCE_ENDPOINT_REGRESSION]: {
    actions: {
      archiveUntilOccurrence: {
        enabled: false,
        disabledReason: t('Not yet supported for regression issues'),
      },
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {
        enabled: false,
        disabledReason: t('Not yet supported for regression issues'),
      },
      share: {enabled: true},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: false},
      openPeriods: {enabled: false},
      checkIns: {enabled: false},
      uptimeChecks: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    discover: {enabled: false},
    regression: {enabled: true},
    performanceDurationRegression: {enabled: true},
    stats: {enabled: false},
    tags: {enabled: false},
    // We show the regression summary instead
    spanEvidence: {enabled: false},
  },
  [IssueType.PROFILE_FILE_IO_MAIN_THREAD]: {
    resources: {
      description: t(
        'File I/O can be a long running operation that blocks the main thread. This may result in app hangs and poor UI performance. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('File I/O on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/main-thread-io/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_JSON_DECODE_MAIN_THREAD]: {
    resources: {
      description: t(
        'Decoding a JSON blob can be a long running operation that blocks the main thread. This may result in app hangs and poor UI performance. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('JSON Decode on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/json-decoding-main-thread/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_IMAGE_DECODE_MAIN_THREAD]: {
    resources: {
      description: t(
        'Decoding a compressed image (e.g. JPEG, PNG) into a bitmap can be a long running operation that blocks the main thread. This may result in app hangs and poor UI performance. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('Image Decode on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/image-decoding-main-thread/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_REGEX_MAIN_THREAD]: {
    resources: {
      description: t(
        'Evaluating matches between strings and regular expressions (regex) can be long-running operations that may impact app responsiveness. This may result in app hangs and poor UI performance. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('Regex on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/regex-main-thread/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_FRAME_DROP]: {
    resources: {
      description: t(
        'The main (or UI) thread in a mobile app is responsible for handling all user interaction and needs to be able to respond to gestures and taps in real time. If a long-running operation blocks the main thread, the app becomes unresponsive, impacting the quality of the user experience. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('Frame Drop'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/frame-drop/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_FRAME_DROP_EXPERIMENTAL]: {
    resources: {
      description: t(
        'The main (or UI) thread in a mobile app is responsible for handling all user interaction and needs to be able to respond to gestures and taps in real time. If a long-running operation blocks the main thread, the app becomes unresponsive, impacting the quality of the user experience. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('Frame Drop'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/frame-drop/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL]: {
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: false},
      openPeriods: {enabled: false},
      uptimeChecks: {enabled: false},
      checkIns: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    discover: {enabled: false},
    regression: {enabled: true},
    profilingDurationRegression: {enabled: true},
    // We show the regression summary instead
    spanEvidence: {enabled: false},
    stats: {enabled: false},
    tags: {enabled: false},
  },
  [IssueType.PROFILE_FUNCTION_REGRESSION]: {
    actions: {
      archiveUntilOccurrence: {
        enabled: false,
        disabledReason: t('Not yet supported for regression issues'),
      },
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {
        enabled: false,
        disabledReason: t('Not yet supported for regression issues'),
      },
      share: {enabled: true},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: false},
      openPeriods: {enabled: false},
      uptimeChecks: {enabled: false},
      checkIns: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    discover: {enabled: false},
    regression: {enabled: true},
    profilingDurationRegression: {enabled: true},
    stats: {enabled: false},
    // We show the regression summary instead
    spanEvidence: {enabled: false},
    tags: {enabled: false},
  },
};

export default performanceConfig;
