import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const httpClientConfig: IssueCategoryConfigMapping = {
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
  [IssueType.PERFORMANCE_HTTP_OVERHEAD]: {
    resources: {
      description: t(
        "HTTP/1.1 can cause overhead, with long request queue times in the browser due to max connection limits. In the Span Evidence section, we've identified the extent of the wait time and spans affected by request queueing. To learn more about how to fix HTTP Overhead, check out these resources:"
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
};

export default httpClientConfig;
