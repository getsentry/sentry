import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

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
      cronChecks: {enabled: false},
      uptimeChecks: {enabled: true},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    resources: null,
    autofix: false,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    usesIssuePlatform: true,
    stats: {enabled: false},
    issueSummary: {enabled: false},
  },
};

export default uptimeConfig;
