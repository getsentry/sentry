import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const metricIssueConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: false},
      delete: {enabled: false},
      deleteAndDiscard: {enabled: false},
      merge: {enabled: false},
      ignore: {enabled: true},
      resolve: {enabled: false},
      resolveInRelease: {enabled: false},
      share: {enabled: true},
    },
    customCopy: {
      resolution: t('Back to baseline'),
      eventUnits: t('Open Periods'),
    },
    detector: {
      enabled: true,
      title: t('Metric Alert Detector'),
      ctaText: t('View detector details'),
    },
    header: {
      filterBar: {enabled: true, fixedEnvironment: false},
      graph: {enabled: true, type: 'detector-history'},
      tagDistribution: {enabled: false},
      occurrenceSummary: {enabled: false},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: false},
      openPeriods: {enabled: true},
      checkIns: {enabled: false},
      uptimeChecks: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    eventAndUserCounts: {enabled: false},
    resources: null,
    autofix: false,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    usesIssuePlatform: true,
    useOpenPeriodChecks: true,
    stats: {enabled: false},
    tags: {enabled: false},
    issueSummary: {enabled: false},
  },
};

export default metricIssueConfig;
