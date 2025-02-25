import {Alert} from 'sentry/components/core/alert/alert';
import {t} from 'sentry/locale';

function ComingSoon() {
  return (
    <Alert.Container>
      <Alert type="info" showIcon>
        {t('This feature is coming soon!')}
      </Alert>
    </Alert.Container>
  );
}

export default ComingSoon;
