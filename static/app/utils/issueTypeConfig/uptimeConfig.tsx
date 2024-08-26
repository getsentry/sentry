import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const uptimeConfig: IssueCategoryConfigMapping = {
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
    resources: null,
    autofix: false,
    aiSuggestedSolution: false,
    mergedIssues: {enabled: false},
    replays: {enabled: false},
    similarIssues: {enabled: false},
    userFeedback: {enabled: false},
    usesIssuePlatform: true,
    stats: {enabled: false},
    tags: {enabled: false},
  },
};

export default uptimeConfig;
