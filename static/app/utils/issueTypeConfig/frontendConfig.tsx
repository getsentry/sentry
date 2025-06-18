import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const frontendConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for user experience issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for user experience issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not supported for user experience issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {enabled: true},
      share: {enabled: true},
    },
    defaultTimePeriod: {sinceFirstSeen: false},
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: false},
      uptimeChecks: {enabled: false},
      checkIns: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: true},
      replays: {enabled: true},
      tagsTab: {enabled: true},
    },
    autofix: false,
    mergedIssues: {enabled: false},
    regression: {enabled: false},
    stats: {enabled: true},
    similarIssues: {enabled: false},
    showFeedbackWidget: true,
    discover: {enabled: true},
    evidence: {title: t('Evidence')},
    resources: null,
    usesIssuePlatform: true,
    issueSummary: {enabled: false},
  },
  [IssueType.PERFORMANCE_UNCOMPRESSED_ASSET]: {
    spanEvidence: {enabled: true},
    evidence: null,
    resources: {
      description: t(
        'Uncompressed assets are asset spans that take over 300ms and are larger than 512kB which can usually be made faster with compression. Check that your server or CDN serving your assets is accepting the content encoding header from the browser and is returning them compressed.'
      ),
      links: [],
      linksByPlatform: {},
    },
    issueSummary: {enabled: true},
    autofix: true,
  },
  [IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET]: {
    spanEvidence: {enabled: true},
    evidence: null,
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
    issueSummary: {enabled: true},
    autofix: true,
  },
};

export default frontendConfig;
