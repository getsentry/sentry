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
      resolveInRelease: {enabled: true},
      share: {enabled: true},
    },
    attachments: {enabled: false},
    autofix: false,
    mergedIssues: {enabled: false},
    replays: {enabled: false},
    similarIssues: {enabled: false},
    userFeedback: {enabled: false},
    usesIssuePlatform: true,
    issueSummary: {enabled: false},
    filterAndSearchHeader: {enabled: false},
  },
};

export default cronConfig;
