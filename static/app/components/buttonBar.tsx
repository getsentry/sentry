import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {ButtonProps, StyledButton} from 'sentry/components/button';
import space, {ValidSize} from 'sentry/styles/space';

type ButtonBarProps = {
  children: React.ReactNode;
  active?: ButtonProps['barId'];
  className?: string;
  gap?: ValidSize;
  merged?: boolean;
};

function ButtonBar({
  children,
  className,
  active,
  merged = false,
  gap = 0,
}: ButtonBarProps) {
  const shouldCheckActive = typeof active !== 'undefined';
  return (
    <ButtonGrid merged={merged} gap={gap} className={className}>
      {!shouldCheckActive
        ? children
        : React.Children.map(children, child => {
            if (!React.isValidElement(child)) {
              return child;
            }

            const {props: childProps, ...childWithoutProps} = child;

            // We do not want to pass `barId` to <Button>`
            const {barId, ...props} = childProps;
            const isActive = active === barId;

            // This ["primary"] could be customizable with a prop,
            // but let's just enforce one "active" type for now
            const priority = isActive ? 'primary' : childProps.priority || 'default';

            return React.cloneElement(childWithoutProps as React.ReactElement, {
              ...props,
              className: classNames(className, {active: isActive}),
              priority,
            });
          })}
    </ButtonGrid>
  );
}

const MergedStyles = () => css`
  /* Raised buttons show borders on both sides. Useful to create pill bars */
  & > .active {
    z-index: 2;
  }

  & > .dropdown,
  & > button,
  & > input,
  & > a {
    position: relative;

    /* First button is square on the right side */
    &:first-child:not(:last-child) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;

      & > .dropdown-actor > ${StyledButton} {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
    }

    /* Middle buttons are square */
    &:not(:last-child):not(:first-child) {
      border-radius: 0;

      & > .dropdown-actor > ${StyledButton} {
        border-radius: 0;
      }
    }

    /* Middle buttons only need one border so we don't get a double line */
    &:first-child {
      & + .dropdown:not(:last-child),
      & + a:not(:last-child),
      & + input:not(:last-child),
      & + button:not(:last-child) {
        margin-left: -1px;
      }
    }

    /* Middle buttons only need one border so we don't get a double line */
    /* stylelint-disable-next-line no-duplicate-selectors */
    &:not(:last-child):not(:first-child) {
      & + .dropdown,
      & + button,
      & + input,
      & + a {
        margin-left: -1px;
      }
    }

    /* Last button is square on the left side */
    &:last-child:not(:first-child) {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: -1px;

      & > .dropdown-actor > ${StyledButton} {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        margin-left: -1px;
      }
    }
  }
`;

const ButtonGrid = styled('div')<{gap: ValidSize; merged: boolean}>`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${p => space(p.gap)};
  align-items: center;

  ${p => p.merged && MergedStyles}
`;

export {ButtonGrid, MergedStyles};
export default ButtonBar;
