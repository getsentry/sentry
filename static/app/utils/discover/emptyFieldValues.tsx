import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export const EMPTY_VALUE_LABEL = t('(no value)');

export const emptyValue = (
  <Text as="span" variant="muted">
    {EMPTY_VALUE_LABEL}
  </Text>
);
export const emptyStringValue = (
  <Text as="span" variant="muted">
    {t('(empty string)')}
  </Text>
);

export function nullableValue(value: string | null): string | React.ReactElement {
  switch (value) {
    case null:
      return emptyValue;
    case '':
      return emptyStringValue;
    default:
      return value;
  }
}
