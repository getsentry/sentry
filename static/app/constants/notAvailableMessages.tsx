import {t} from 'sentry/locale';

const NOT_AVAILABLE_MESSAGES = {
  performance: t('This view is only available with Performance Monitoring.'),
  discover: t('This view is only available with Discover.'),
  releaseHealth: t('This view is only available with Release Health.'),
};

export default NOT_AVAILABLE_MESSAGES;
