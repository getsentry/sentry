import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import {Text} from 'sentry/components/core/text/text';

export function OrOpRow() {
  const label = 'Assert Any';

  return (
    <Tooltip title={label} showOnlyOnOverflow>
      <Text ellipsis>{label}</Text>
    </Tooltip>
  );
}
