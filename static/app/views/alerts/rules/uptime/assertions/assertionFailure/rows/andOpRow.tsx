import {Tooltip} from '@sentry/scraps/tooltip';

import {Text} from 'sentry/components/core/text/text';

export function AndOpRow() {
  const label = 'Assert All';

  return (
    <Tooltip title={label} showOnlyOnOverflow>
      <Text ellipsis>{label}</Text>
    </Tooltip>
  );
}
