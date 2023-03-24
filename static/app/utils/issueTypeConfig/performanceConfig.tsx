import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types';
import {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const performanceConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
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
      share: {enabled: true},
    },
    attachments: {enabled: false},
    grouping: {enabled: false},
    mergedIssues: {enabled: false},
    replays: {enabled: false},
    similarIssues: {enabled: false},
    userFeedback: {enabled: false},
    // Performance issues render a custom SpanEvidence component
    evidence: null,
    usesIssuePlatform: false,
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
        'A Consecutive HTTP issue occurs when X number of consecutive HTTP calls occur sequentially, each taking Y amount of time'
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
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/main-thread-io/',
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
        'Slow DB Queries are SELECT query spans that are consistently taking longer than 1s. A quick method to understand why this may be the case is running an EXPLAIN command on the query itself. To learn more about how to fix slow DB queries, check out these resources:'
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

  [IssueType.PERFORMANCE_UNCOMPRESSED_ASSET]: {
    resources: {
      description: t(
        'Uncompressed assets are asset spans that take over 500ms and are larger than 512kB which can usually be made faster with compression. Check that your server or CDN serving your assets is accepting the content encoding header from the browser and is returning them compressed.'
      ),
      links: [],
      linksByPlatform: {},
    },
  },
};

export default performanceConfig;
