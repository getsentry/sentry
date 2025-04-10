import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {capitalize} from 'sentry/utils/string/capitalize';

export type TypeCellProps = {
  type: 'metric' | 'errors' | 'performance' | 'trace' | 'replay' | 'uptime';
  className?: string;
  disabled?: boolean;
};

export function TypeCell({type, disabled = false, className}: TypeCellProps) {
  return (
    <Type disabled={disabled} className={className}>
      {capitalize(type)}
    </Type>
  );
}

const Type = styled('div')<{disabled: boolean}>`
  color: ${p => p.theme.textColor};
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};

  ${p =>
    p.disabled &&
    `
    color: ${p.theme.disabled};
  `}
`;
