import {Alert} from '@sentry/scraps/alert';

import {t} from 'sentry/locale';

export function NoAccess() {
  return (
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
  );
}
