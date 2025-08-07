import {IconUser} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

export function UserCell({value}: {value: number}) {
  return (
    <div
      style={{
        minWidth: '0',
        display: 'flex',
        alignItems: 'center',
        gap: space(0.5),
        justifyContent: 'flex-end',
      }}
    >
      {formatAbbreviatedNumber(value)}
      <IconUser size="xs" />
    </div>
  );
}
