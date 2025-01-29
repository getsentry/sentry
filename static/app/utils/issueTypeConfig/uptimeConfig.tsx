import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const uptimeConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
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
      filterAndSearch: {enabled: true},
      tagDistribution: {enabled: false},
      timelineSummary: {enabled: true},
    },
    detector: {
      enabled: true,
      title: t('Uptime Monitor'),
      ctaText: t('View alert details'),
    },
    customCopy: {
      eventUnits: t('Check-ins'),
      resolution: t('Resolved'),
    },
    attachments: {enabled: false},
    resources: null,
    autofix: false,
    mergedIssues: {enabled: false},
    replays: {enabled: false},
    similarIssues: {enabled: false},
    userFeedback: {enabled: false},
    usesIssuePlatform: true,
    stats: {enabled: false},
    tagsTab: {enabled: false},
    issueSummary: {enabled: false},
  },
};

export default uptimeConfig;
