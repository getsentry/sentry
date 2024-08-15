import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const replayConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {enabled: false},
      deleteAndDiscard: {enabled: false},
      merge: {enabled: false},
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
    tags: {enabled: true},
    userFeedback: {enabled: true},
    discover: {enabled: true},
    evidence: {title: t('Evidence')},
    resources: null,
    usesIssuePlatform: true,
  },
};

export default replayConfig;
