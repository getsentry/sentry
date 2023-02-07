import {t} from 'sentry/locale';
import {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const performanceConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for performance issues'),
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
      share: {enabled: true},
    },
    attachments: {enabled: false},
    grouping: {enabled: false},
    mergedIssues: {enabled: false},
    replays: {enabled: false},
    similarIssues: {enabled: false},
    userFeedback: {enabled: false},
    // Performance issues render a custom SpanEvidence component
    evidence: null,
  },
};

export default performanceConfig;
