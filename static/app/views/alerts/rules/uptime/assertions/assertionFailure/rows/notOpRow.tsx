import {Tooltip} from '@sentry/scraps/tooltip';

import {Text} from 'sentry/components/core/text/text';
import {t} from 'sentry/locale';

export function NotOpRow() {
  const label = t('Assert NOT');

  return (
    <Tooltip title={label} showOnlyOnOverflow>
      <Text ellipsis>{label}</Text>
    </Tooltip>
  );
}
