import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const cronConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
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
      filterAndSearch: {enabled: false},
      tagDistribution: {enabled: false},
      timelineSummary: {enabled: false},
    },
    attachments: {enabled: false},
    autofix: false,
    mergedIssues: {enabled: false},
    replays: {enabled: false},
    similarIssues: {enabled: false},
    userFeedback: {enabled: false},
    usesIssuePlatform: true,
    issueSummary: {enabled: false},
  },
};

export default cronConfig;
