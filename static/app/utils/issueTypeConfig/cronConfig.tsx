import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

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
      checkIns: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: true},
    },
    autofix: false,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    usesIssuePlatform: true,
    issueSummary: {enabled: false},
  },
};

export default cronConfig;
