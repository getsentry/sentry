import {css} from '@emotion/react';
import styled from '@emotion/styled';

export const Row = styled('div', {
  shouldForwardProp: prop => prop !== 'collapsed' && prop !== 'withBorder',
})<{collapsed?: boolean; withBorder?: boolean}>`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 24px;
  max-width: 100%;

  ${p =>
    p.withBorder &&
    css`
      border: 1px solid ${p.theme.tokens.border.secondary};
      border-radius: ${p.theme.radius.md};
    `}

  /* Empty spacers must not consume a flex line. A wide _if function is
     max-width 100%, so even a few pixels of leading/trailing free text wrap
     onto their own row. Last-child still grows to fill leftover space. */
  ${p =>
    p.collapsed &&
    css`
      width: 0;
      min-width: 0;
      flex-grow: 0;
      flex-shrink: 0;
      flex-basis: 0;
      overflow: visible;
    `}

  &:last-child {
    flex-grow: 1;
    min-width: 0;
    max-width: none;
    flex-basis: 0;
    align-self: stretch;
    height: auto;
    min-height: 24px;
  }

  &[aria-invalid='true'] {
    input {
      color: ${p => p.theme.colors.red500};
    }
  }

  &[aria-selected='true'] {
    [data-hidden-text='true']::before {
      content: '';
      position: absolute;
      left: ${p => p.theme.space.xs};
      right: ${p => p.theme.space.xs};
      top: 0;
      bottom: 0;
      background-color: ${p => p.theme.colors.gray100};
    }
  }
`;

export const GridCell = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
`;

export const LeftGridCell = styled(GridCell)`
  padding-left: ${p => p.theme.space.xs};
`;
