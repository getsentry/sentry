import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {SpaceSize} from 'sentry/utils/theme';

interface ButtonBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> {
  children: React.ReactNode;
  gap?: SpaceSize;
  merged?: boolean;
}

export function ButtonBar({
  children,
  merged = false,
  gap = 'md',
  ...props
}: ButtonBarProps) {
  return (
    <StyledButtonBar merged={merged} gap={gap} {...props}>
      {children}
    </StyledButtonBar>
  );
}

const StyledButtonBar = styled('div')<{gap: SpaceSize; merged: boolean}>`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${p => p.theme.space[p.gap]};
  align-items: center;

  ${p => p.merged && MergedButtonBarStyles}
`;

const MergedButtonBarStyles = () => css`
  /* Raised buttons show borders on both sides. Useful to create pill bars */
  & > .active {
    z-index: 2;
  }

  & > [role='presentation'],
  & > .dropdown,
  & > button,
  & > input,
  & > a {
    position: relative;

    /* First button is square on the right side */
    &:first-child:not(:last-child) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;

      & > .dropdown-actor > button {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
    }

    /* Middle buttons are square */
    &:not(:last-child):not(:first-child),
    &[role='presentation']:not(:last-child):not(:first-child) > button {
      border-radius: 0;

      & > .dropdown-actor > button {
        border-radius: 0;
      }
    }

    /* Middle buttons only need one border so we don't get a double line */
    &:first-child {
      & + [role='presentation'] > button,
      & + .dropdown:not(:last-child),
      & + a:not(:last-child),
      & + input:not(:last-child),
      & + button:not(:last-child) {
        margin-left: -1px;
      }
    }

    /* Last button is square on the left side */
    &:last-child:not(:first-child) {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: -1px;

      & > .dropdown-actor > button,
      &[role='presentation'] > button {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        margin-left: -1px;
      }
    }
  }
`;
