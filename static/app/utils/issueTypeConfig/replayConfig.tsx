import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const replayConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for replay issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for replay issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not supported for replay issues'),
      },
      ignore: {enabled: true},
      resolveInRelease: {enabled: true},
      share: {enabled: true},
    },
    attachments: {enabled: false},
    autofix: false,
    aiSuggestedSolution: false,
    events: {enabled: true},
    mergedIssues: {enabled: false},
    regression: {enabled: false},
    replays: {enabled: true},
    stats: {enabled: true},
    similarIssues: {enabled: false},
    showFeedbackWidget: true,
    tagsTab: {enabled: true},
    userFeedback: {enabled: true},
    discover: {enabled: true},
    evidence: {title: t('Evidence')},
    resources: null,
    usesIssuePlatform: true,
    issueSummary: {enabled: false},
  },
};

export default replayConfig;
