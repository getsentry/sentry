import {Tooltip} from '@sentry/scraps/tooltip';

import {Text} from 'sentry/components/core/text/text';

export function NotOpRow() {
  const label = 'Assert NOT';

  return (
    <Tooltip title={label} showOnlyOnOverflow>
      <Text ellipsis>{label}</Text>
    </Tooltip>
  );
}
