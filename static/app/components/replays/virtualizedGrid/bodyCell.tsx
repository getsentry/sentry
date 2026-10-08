import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

const cellBackground = (p: CellProps & {theme: Theme}) => {
  if (p.isSelected) {
    return `background-color: ${p.theme.tokens.background.accent.vibrant};`;
  }
  if (p.isStatusError) {
    return `background-color: ${p.theme.colors.red100};`;
  }
  if (p.isStatusWarning) {
    return 'background-color: var(--background-warning-default, rgba(245, 176, 0, 0.09));';
  }
  return 'background-color: inherit;';
};

const cellColor = (p: CellProps & {theme: Theme}) => {
  if (p.isSelected) {
    const color = p.theme.colors.white;
    return `color: ${color};`;
  }

  return 'color: inherit';
};

type CellProps = {
  className?: string;
  hasOccurred?: boolean;
  isSelected?: boolean;
  isStatusError?: boolean;
  isStatusWarning?: boolean;
  numeric?: boolean;
  onClick?: undefined | (() => void);
};

export const Cell = styled(SimpleTable.RowCell)<CellProps>`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
  cursor: ${p => (p.onClick ? 'pointer' : 'inherit')};

  ${cellBackground}
  ${cellColor}

  ${p =>
    p.numeric &&
    css`
      font-variant-numeric: tabular-nums;
      justify-content: flex-end;
    `}
`;

export const Text = styled('div')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  display: flex;
  gap: ${p => p.theme.space.xs};
`;

export function AvatarWrapper(props: ContainerProps) {
  return <Container alignSelf="center" {...props} />;
}

export const ButtonWrapper = styled('div')`
  align-items: center;
`;
