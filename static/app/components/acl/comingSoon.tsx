import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';

function ComingSoon() {
  return (
    <Alert.Container>
      <Alert margin type="info" showIcon>
        {t('This feature is coming soon!')}
      </Alert>
    </Alert.Container>
  );
}

export default ComingSoon;
