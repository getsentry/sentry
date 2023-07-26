import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

const cellBackground = (p: CellProps & {theme: Theme}) => {
  if (p.isSelected) {
    return `background-color: ${p.theme.textColor};`;
  }
  if (p.hasOccurred === undefined && !p.isStatusError) {
    return `background-color: inherit;`;
  }
  const color = p.isStatusError ? p.theme.alert.error.backgroundLight : 'inherit';
  return `background-color: ${color};`;
};

const cellColor = (p: CellProps & {theme: Theme}) => {
  if (p.isSelected) {
    const colors = p.isStatusError
      ? [p.theme.alert.error.background]
      : [p.theme.background];
    return `color: ${colors[0]};`;
  }
  const colors = p.isStatusError
    ? [p.theme.alert.error.borderHover, p.theme.alert.error.iconColor]
    : ['inherit', p.theme.gray300];

  return `color: ${p.hasOccurred !== false ? colors[0] : colors[1]};`;
};

type CellProps = {
  align?: 'flex-start' | 'flex-end';
  className?: string;
  hasOccurred?: boolean;
  isSelected?: boolean;
  isStatusError?: boolean;
  numeric?: boolean;
  onClick?: undefined | (() => void);
};

export const Cell = styled('div')<CellProps>`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  cursor: ${p => (p.onClick ? 'pointer' : 'inherit')};

  ${cellBackground}
  ${cellColor}

  ${p =>
    p.numeric &&
    `
    font-variant-numeric: tabular-nums;
    justify-content: ${p.align ?? 'flex-end'};
  `};
`;

export const Text = styled('div')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  padding: ${space(0.75)} ${space(1.5)};
  display: flex;
  gap: ${space(0.5)};
`;

export const AvatarWrapper = styled('div')`
  align-self: center;
`;

export const StyledTimestampButton = styled(TimestampButton)`
  padding-inline: ${space(1.5)};
`;
