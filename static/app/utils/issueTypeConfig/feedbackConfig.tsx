import {t} from 'sentry/locale';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const feedbackConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    usesIssuePlatform: true,
    evidence: {title: t('Feedback')},
    issueSummary: {enabled: false},
  },
};

export default feedbackConfig;
