import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const cellBackground = (p: CellProps & {theme: Theme}) => {
  if (p.isSelected) {
    return `background-color: ${p.theme.tokens.background.accent.vibrant};`;
  }
  if (p.isStatusError) {
    return `background-color: ${p.theme.colors.red100};`;
  }
  if (p.isStatusWarning) {
    return `background-color: var(--background-warning-default, rgba(245, 176, 0, 0.09));`;
  }
  return `background-color: inherit;`;
};

const cellColor = (p: CellProps & {theme: Theme}) => {
  if (p.isSelected) {
    const color = p.theme.colors.white;
    return `color: ${color};`;
  }

  return `color: inherit`;
};

type CellProps = {
  align?: 'flex-start' | 'flex-end';
  className?: string;
  hasOccurred?: boolean;
  isSelected?: boolean;
  isStatusError?: boolean;
  isStatusWarning?: boolean;
  numeric?: boolean;
  onClick?: undefined | (() => void);
};

export const Cell = styled('div')<CellProps>`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  cursor: ${p => (p.onClick ? 'pointer' : 'inherit')};

  ${cellBackground}
  ${cellColor}

  ${p =>
    p.numeric &&
    css`
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

export const ButtonWrapper = styled('div')`
  align-items: center;
  padding-inline: ${space(1.5)};
`;
