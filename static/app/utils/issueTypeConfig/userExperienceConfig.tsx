import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const userExperienceConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for user experience issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for user experience issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not supported for user experience issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {enabled: true},
      share: {enabled: true},
    },
    defaultTimePeriod: {sinceFirstSeen: false},
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: false},
      uptimeChecks: {enabled: false},
      checkIns: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: true},
      replays: {enabled: true},
      tagsTab: {enabled: true},
    },
    autofix: false,
    mergedIssues: {enabled: false},
    regression: {enabled: false},
    stats: {enabled: true},
    similarIssues: {enabled: false},
    showFeedbackWidget: true,
    discover: {enabled: true},
    evidence: {title: t('Evidence')},
    resources: null,
    usesIssuePlatform: true,
    issueSummary: {enabled: false},
  },
};

export default userExperienceConfig;
