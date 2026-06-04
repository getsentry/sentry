import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

export function NoAccess() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    </Stack>
  );
}
