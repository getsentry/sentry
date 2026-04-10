import {css} from '@emotion/react';
import styled from '@emotion/styled';

export const Row = styled('div')<{withBorder?: boolean}>`
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

  &:last-child {
    flex-grow: 1;
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
