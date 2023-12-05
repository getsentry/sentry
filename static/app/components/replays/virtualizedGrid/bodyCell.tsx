import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {space} from 'sentry/styles/space';

const cellBackground = (p: CellProps & {theme: Theme}) => {
  if (p.isSelected) {
    return `background-color: ${p.theme.black};`;
  }
  if (p.isStatusError) {
    return `background-color: ${p.theme.red100};`;
  }
  if (p.isStatusWarning) {
    return `background-color: var(--background-warning-default, rgba(245, 176, 0, 0.09));`;
  }
  return `background-color: inherit;`;
};

const cellColor = (p: CellProps & {theme: Theme}) => {
  if (p.isSelected) {
    const color = p.isStatusError
      ? p.theme.red300
      : p.isStatusWarning
      ? p.theme.yellow300
      : p.theme.white;
    return `color: ${color};`;
  }
  const colors = p.isStatusError
    ? [p.theme.red300, p.theme.red400]
    : p.isStatusWarning
    ? [p.theme.textColor, p.theme.subText]
    : ['inherit', p.theme.subText];

  return `color: ${p.hasOccurred !== false ? colors[0] : colors[1]};`;
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

export const CodeHighlightCell = styled(CodeSnippet)`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  padding: ${space(0.75)} 0;
  display: flex;
  gap: ${space(0.5)};
  --prism-block-background: transparent;
`;

export const AvatarWrapper = styled('div')`
  align-self: center;
`;

export const ButtonWrapper = styled('div')`
  align-items: center;
  padding-inline: ${space(1.5)};
`;
