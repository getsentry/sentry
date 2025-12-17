import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const outageConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    usesIssuePlatform: true,
    autofix: false,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    issueSummary: {enabled: false},
    groupingInfo: {enabled: false},
  },
  [IssueType.MONITOR_CHECK_IN_FAILURE]: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for cron issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for cron issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for cron issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: false},
      resolveInRelease: {enabled: false},
      share: {enabled: true},
    },
    header: {
      filterBar: {enabled: true},
      graph: {enabled: true, type: 'cron-checks'},
      tagDistribution: {enabled: false},
      occurrenceSummary: {enabled: true},
    },
    detector: {
      enabled: true,
      title: t('Cron Monitor'),
      ctaText: t('View monitor details'),
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: false},
      uptimeChecks: {enabled: false},
      checkIns: {enabled: true},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: true},
    },
  },
  [IssueType.UPTIME_DOMAIN_FAILURE]: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {enabled: false},
      deleteAndDiscard: {enabled: false},
      merge: {enabled: false},
      ignore: {enabled: true},
      resolve: {enabled: false},
      resolveInRelease: {enabled: false},
      share: {enabled: true},
    },
    header: {
      filterBar: {enabled: true, fixedEnvironment: true},
      graph: {enabled: true, type: 'uptime-checks'},
      tagDistribution: {enabled: false},
      occurrenceSummary: {enabled: true, downtime: true},
    },
    detector: {
      enabled: true,
      title: t('Uptime Monitor'),
      ctaText: t('View alert details'),
    },
    customCopy: {
      eventUnits: t('Events'),
      resolution: t('Resolved'),
    },
    pages: {
      landingPage: Tab.EVENTS,
      events: {enabled: true},
      openPeriods: {enabled: false},
      checkIns: {enabled: false},
      uptimeChecks: {enabled: true},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    resources: null,
    stats: {enabled: false},
  },
};

export default outageConfig;
