import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

export const configurationIssuesConfig: IssueCategoryConfigMapping = {
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
    defaultTimePeriod: {sinceFirstSeen: false},
    customCopy: {
      resolution: t('Auto-resolved'),
      eventUnits: t('Open Periods'),
    },
    usesIssuePlatform: true,
    useOpenPeriodChecks: true,
    evidence: {title: t('Details')},
    issueSummary: {enabled: false},
    stacktrace: {enabled: false},
    autofix: false,
    similarIssues: {enabled: false},
    mergedIssues: {enabled: false},
    regression: {enabled: false},
    eventAndUserCounts: {enabled: false},
    tags: {enabled: false},
    stats: {enabled: false},
    header: {
      filterBar: {enabled: true, fixedEnvironment: true, searchBar: {enabled: false}},
      graph: {enabled: true, type: 'discover-events'},
      eventNavigation: {enabled: true},
      tagDistribution: {enabled: false},
      occurrenceSummary: {enabled: false},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: true},
      checkIns: {enabled: false},
      uptimeChecks: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    discover: {enabled: false},
    groupingInfo: {enabled: false},
  },
  [IssueType.SOURCEMAP_CONFIGURATION]: {
    evidence: null,
    header: {
      filterBar: {enabled: false},
      graph: {enabled: false},
      eventNavigation: {enabled: false},
      tagDistribution: {enabled: false},
      occurrenceSummary: {enabled: false},
    },
  },
};
