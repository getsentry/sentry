import React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {StyledButton} from 'sentry/components/core/button';
import type {ValidSize} from 'sentry/styles/space';
import {space} from 'sentry/styles/space';

interface ButtonBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> {
  children: React.ReactNode;
  gap?: ValidSize | 0;
  merged?: boolean;
}

export function ButtonBar({children, merged = false, gap = 0, ...props}: ButtonBarProps) {
  return (
    <StyledButtonBar
      merged={merged}
      gap={gap}
      {...props}
      listSize={React.Children.count(children)}
    >
      {children}
    </StyledButtonBar>
  );
}

const getChildTransforms = (count: number) => {
  return Array.from(
    {length: count},
    // Do not use translate, as it will create a new stacking context which might break
    // focus styles for dropdowns, causing them to fall under other elements positioned on the page.
    (_, index) => css`
      > *:nth-child(${index + 1}),
      > *:nth-child(${index + 1}) > button {
        margin-left: -${index}px;
      }
    `
  );
};

const StyledButtonBar = styled('div')<{
  gap: ValidSize | 0;
  listSize: number;
  merged: boolean;
}>`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${p => (p.gap === 0 ? '0' : space(p.gap))};
  align-items: center;

  ${p => getChildTransforms(p.listSize)}

  ${p =>
    p.merged &&
    css`
      /* Raised buttons show borders on both sides. Useful to create pill bars */
      & > .active,
      & *:focus-visible {
        z-index: 2;
      }

      & > * {
        position: relative;

        /* First button is square on the right side */
        &:first-child:not(:last-child),
        &:first-child:not(:last-child) > button {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;

          & > .dropdown-actor > ${StyledButton} {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
          }
        }

        /* Middle buttons are square */
        &:not(:last-child):not(:first-child),
        &:not(:last-child):not(:first-child) > button {
          border-radius: 0;

          & > .dropdown-actor > ${StyledButton} {
            border-radius: 0;
          }
        }

        /* Last button is square on the left side */
        &:last-child:not(:first-child) {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;

          & > button,
          & > .dropdown-actor > ${StyledButton} {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
          }
        }
      }
    `}
`;
