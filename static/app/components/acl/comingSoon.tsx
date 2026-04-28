import {Alert} from '@sentry/scraps/alert';

import {t} from 'sentry/locale';

export function ComingSoon() {
  return (
    <Alert.Container>
      <Alert variant="info">{t('This feature is coming soon!')}</Alert>
    </Alert.Container>
  );
}
