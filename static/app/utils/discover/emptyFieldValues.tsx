import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export const emptyValue = (
  <Text as="span" variant="muted">
    {t('(no value)')}
  </Text>
);
export const emptyStringValue = (
  <Text as="span" variant="muted">
    {t('(empty string)')}
  </Text>
);
