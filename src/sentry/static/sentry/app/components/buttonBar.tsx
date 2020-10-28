import React from 'react';
import classNames from 'classnames';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import space, {ValidSize} from 'app/styles/space';

type ButtonBarProps = {
  children: React.ReactNode;
  gap?: ValidSize;
  merged?: boolean;
  active?: React.ComponentProps<typeof Button>['barId'];
  className?: string;
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

const ButtonGrid = styled('div')<{gap: ValidSize; merged: boolean}>`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${p => space(p.gap)};
  align-items: center;

  ${p =>
    p.merged &&
    `
    & > button,
    & > a {
      position: relative;
    }

    /* Raised buttons show borders on both sides. Useful to create pill bars */
    & > .active {
      z-index: 2;
    }

    /* First button is square on the right side */
    & > button:first-child:not(:last-child),
    & > a:first-child:not(:last-child) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
    /* Middle buttons are square */
    & > button:not(:last-child):not(:first-child),
    & > a:not(:last-child):not(:first-child) {
      border-radius: 0;
    }

    /* Middle buttons only need one border so we don't get a double line */
    & > a:first-child + a:not(:last-child),
    & > button:first-child + button:not(:last-child) {
      margin-left: -1px;
    }

    /* Middle buttons only need one border so we don't get a double line */
    & > button:not(:last-child):not(:first-child) + button,
    & > a:not(:last-child):not(:first-child) + a {
      margin-left: -1px;
    }

    /* Last button is square on the left side */
    & > button:last-child:not(:first-child),
    & > a:last-child:not(:first-child) {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: -1px;
    }
  `}
`;

export default ButtonBar;
