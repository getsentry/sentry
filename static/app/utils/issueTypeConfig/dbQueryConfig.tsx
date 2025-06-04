import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const dbQueryConfig: IssueCategoryConfigMapping = {
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
    autofix: true,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    stacktrace: {enabled: false},
    spanEvidence: {enabled: true},
    // Performance issues render a custom SpanEvidence component
    evidence: null,
    usesIssuePlatform: true,
    issueSummary: {enabled: true},
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
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
    resources: {
      description: t(
        "N+1 queries are extraneous queries (N) caused by a single, initial query (+1). In the Span Evidence section, we've identified the parent span where the extraneous spans are located and the extraneous spans themselves. To learn more about how to fix N+1 problems, check out these resources:"
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
};

export default dbQueryConfig;
