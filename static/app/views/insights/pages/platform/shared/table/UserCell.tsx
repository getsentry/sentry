import {useTheme} from '@emotion/react';

import {IconUser} from 'sentry/icons';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

export function UserCell({value}: {value: number}) {
  const theme = useTheme();
  return (
    <div
      style={{
        minWidth: '0',
        display: 'flex',
        alignItems: 'center',
        gap: theme.space.xs,
        justifyContent: 'flex-end',
      }}
    >
      {formatAbbreviatedNumber(value)}
      <IconUser size="xs" />
    </div>
  );
}
