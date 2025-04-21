import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const performanceRegressionConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for regression issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for regression issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for regression issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {
        enabled: false,
        disabledReason: t('Not yet supported for regression issues'),
      },
      share: {enabled: true},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: false},
      checkIns: {enabled: false},
      uptimeChecks: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: true},
      tagsTab: {enabled: true},
    },
    autofix: false,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    stacktrace: {enabled: false},
    spanEvidence: {enabled: false},
    evidence: null,
    usesIssuePlatform: true,
    issueSummary: {enabled: false},
  },
  [IssueType.PERFORMANCE_DURATION_REGRESSION]: {
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
    regression: {enabled: true},
    performanceDurationRegression: {enabled: true},
    stats: {enabled: false},
    tags: {enabled: false},
  },
  [IssueType.PERFORMANCE_ENDPOINT_REGRESSION]: {
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
    regression: {enabled: true},
    performanceDurationRegression: {enabled: true},
    stats: {enabled: false},
    tags: {enabled: false},
  },
  [IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL]: {
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: false},
      openPeriods: {enabled: false},
      uptimeChecks: {enabled: false},
      checkIns: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    discover: {enabled: false},
    regression: {enabled: true},
    profilingDurationRegression: {enabled: true},
    stats: {enabled: false},
    tags: {enabled: false},
  },
  [IssueType.PROFILE_FUNCTION_REGRESSION]: {
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: false},
      openPeriods: {enabled: false},
      uptimeChecks: {enabled: false},
      checkIns: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    discover: {enabled: false},
    regression: {enabled: true},
    profilingDurationRegression: {enabled: true},
    stats: {enabled: false},
    tags: {enabled: false},
  },
};

export default performanceRegressionConfig;
