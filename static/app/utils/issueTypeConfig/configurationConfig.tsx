import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const configurationConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    usesIssuePlatform: true,
    evidence: {title: t('Details')},
    issueSummary: {enabled: false},
    stacktrace: {enabled: false},
    autofix: false,
    similarIssues: {enabled: false},
    mergedIssues: {enabled: false},
    regression: {enabled: false},
    tags: {enabled: false},
    stats: {enabled: false},
    header: {
      filterBar: {enabled: true, fixedEnvironment: true, searchBar: {enabled: false}},
      graph: {enabled: true, type: 'discover-events'},
      tagDistribution: {enabled: false},
      occurrenceSummary: {enabled: false},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: false},
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
};

export default configurationConfig;
