import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const instrumentationConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    usesIssuePlatform: true,
    evidence: {title: t('Details')},
    issueSummary: {enabled: true},
    // Instrumentation issues don't have traditional stacktraces
    stacktrace: {enabled: false},
    // Disable features that don't apply to instrumentation suggestions
    autofix: true,
    similarIssues: {enabled: false},
    mergedIssues: {enabled: false},
    regression: {enabled: false},
    // Hide tags since these issues aren't tied to specific events
    tags: {enabled: false},
    stats: {enabled: false},
    header: {
      filterBar: {enabled: false},
      graph: {enabled: false},
      tagDistribution: {enabled: false},
      occurrenceSummary: {enabled: false},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: false},
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

export default instrumentationConfig;
