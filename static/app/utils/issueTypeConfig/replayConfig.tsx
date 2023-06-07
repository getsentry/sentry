import {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const errorConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      delete: {enabled: true},
      deleteAndDiscard: {enabled: true},
      ignore: {enabled: true},
      merge: {enabled: true},
      share: {enabled: false},
    },
    attachments: {enabled: false},
    grouping: {enabled: true},
    mergedIssues: {enabled: true},
    replays: {enabled: true},
    similarIssues: {enabled: true},
    userFeedback: {enabled: true},
    usesIssuePlatform: true,
  },
};

export default errorConfig;
