import React from 'react';
import classNames from 'classnames';
import styled from '@emotion/styled';

import space, {ValidSize} from 'app/styles/space';

type ButtonBarProps = {
  className?: string;
  gap?: ValidSize;
  merged?: boolean;
  active?: string | number;
  children: React.ReactNode;
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

            // We do not want to pass `id` to <Button>`
            const {id, ...props} = childProps;
            const isActive = active === id;
            const priority = isActive ? 'primary' : childProps.priority || 'default';

            return React.cloneElement(childWithoutProps as React.ReactElement, {
              ...props,
              className: classNames(className, {active: isActive}),
              // This could be customizable with a prop, but let's just enforce one "active" type for now
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
