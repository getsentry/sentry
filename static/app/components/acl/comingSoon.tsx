import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';

const ComingSoon = () => (
  <Alert type="info" showIcon>
    {t('This feature is coming soon!')}
  </Alert>
);

export default ComingSoon;
