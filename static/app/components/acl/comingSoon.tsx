import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

function ComingSoon() {
  return (
    <Alert.Container>
      <Alert type="info">{t('This feature is coming soon!')}</Alert>
    </Alert.Container>
  );
}

export default ComingSoon;
