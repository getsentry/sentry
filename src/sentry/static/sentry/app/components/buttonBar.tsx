import React from 'react';
import styled from '@emotion/styled';
import space, {ValidSize} from 'app/styles/space';

type ButtonBarProps = {
  gap?: ValidSize;
  merged?: boolean;
  children: React.ReactNode;
};

function ButtonBar({children, merged = false, gap = 0}: ButtonBarProps) {
  return (
    <ButtonGrid merged={merged} gap={gap} childCount={React.Children.count(children)}>
      {children}
    </ButtonGrid>
  );
}

const ButtonGrid = styled('div')<{gap: ValidSize; childCount: number; merged: boolean}>`
  display: grid;
  grid-template-columns: repeat(${p => p.childCount}, minmax(10px, auto));
  grid-column-gap: ${p => space(p.gap)};
  align-items: center;

  ${p =>
    p.merged &&
    `
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
      border-left: 0;
    }

    /* Middle buttons only need one border so we don't get a double line */
    & > button:not(:last-child):not(:first-child) + button,
    & > a:not(:last-child):not(:first-child) + a {
      border-left: 0;
    }

    /* Last button is square on the left side */
    & > button:last-child:not(:first-child),
    & > a:last-child:not(:first-child) {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  `}
`;

export default ButtonBar;
