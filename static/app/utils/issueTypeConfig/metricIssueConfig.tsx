import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

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
    attachments: {enabled: false},
    eventAndUserCounts: {enabled: false},
    resources: null,
    autofix: false,
    events: {enabled: false},
    mergedIssues: {enabled: false},
    replays: {enabled: false},
    similarIssues: {enabled: false},
    showOpenPeriods: true,
    userFeedback: {enabled: false},
    usesIssuePlatform: true,
    useOpenPeriodChecks: true,
    stats: {enabled: false},
    tags: {enabled: false},
    tagsTab: {enabled: false},
    issueSummary: {enabled: false},
  },
};

export default metricIssueConfig;
