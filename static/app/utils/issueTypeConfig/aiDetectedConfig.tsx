import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const aiDetectedConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {
        enabled: true,
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {enabled: true},
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
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    autofix: true,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    stacktrace: {enabled: false},
    spanEvidence: {enabled: true},
    evidence: null,
    usesIssuePlatform: true,
    issueSummary: {enabled: true},
  },
};

export default aiDetectedConfig;
