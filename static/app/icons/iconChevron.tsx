import {Fragment} from 'react';
import {css, useTheme, type Theme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
  /**
   * @deprecated Circled variant will be removed.
   */
  isCircled?: boolean;
  isDouble?: boolean;
}

function getChevronPath({
  isCircled,
  isDouble,
  theme,
}: Pick<Props, 'isCircled' | 'isDouble'> & {theme: Theme}) {
  if (theme.isChonk) {
    if (isDouble) {
      return (
        <path d="M7.99951 8C8.20581 8 8.40276 8.0854 8.54443 8.23535L12.7944 12.7354C13.0788 13.0365 13.0652 13.5105 12.7642 13.7949C12.463 14.0793 11.989 14.0658 11.7046 13.7646L7.99951 9.84082L4.29443 13.7646C4.01002 14.0658 3.536 14.0793 3.23486 13.7949C2.93382 13.5105 2.92021 13.0365 3.20459 12.7354L7.45459 8.23535C7.59626 8.08538 7.79321 8.00001 7.99951 8ZM7.99951 2C8.20581 2.00004 8.40278 2.08537 8.54443 2.23535L12.7944 6.73535C13.0788 7.03645 13.0652 7.51051 12.7642 7.79492C12.463 8.07932 11.989 8.06576 11.7046 7.76465L7.99951 3.84082L4.29443 7.76465C4.01004 8.06577 3.536 8.07929 3.23486 7.79492C2.93372 7.51051 2.92018 7.03649 3.20459 6.73535L7.45459 2.23535C7.59626 2.0854 7.79322 2 7.99951 2ZZ" />
      );
    }
    return (
      <path d="M7.99969 5C8.20598 5 8.40294 5.08541 8.54462 5.23535L12.7946 9.73535C13.079 10.0365 13.0655 10.5105 12.7643 10.7949C12.4632 11.0791 11.9891 11.0657 11.7048 10.7646L7.99969 6.84082L4.29462 10.7646C4.01019 11.0656 3.53612 11.0793 3.23505 10.7949C2.9341 10.5106 2.92059 10.0365 3.20477 9.73535L7.45477 5.23535C7.59639 5.08541 7.79346 5.00008 7.99969 5Z" />
    );
  }

  if (isCircled) {
    return (
      <Fragment>
        <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
        <path d="M11.12,9.87a.73.73,0,0,1-.53-.22L8,7.07,5.41,9.65a.74.74,0,0,1-1.06,0,.75.75,0,0,1,0-1.06L7.47,5.48a.74.74,0,0,1,1.06,0l3.12,3.11a.75.75,0,0,1,0,1.06A.74.74,0,0,1,11.12,9.87Z" />
      </Fragment>
    );
  }

  if (isDouble) {
    return (
      <Fragment>
        <g transform="translate(0 -4)">
          <path d="M14,11.75a.74.74,0,0,1-.53-.22L8,6.06,2.53,11.53a.75.75,0,0,1-1.06-1.06l6-6a.75.75,0,0,1,1.06,0l6,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,14,11.75Z" />
        </g>
        <g transform="translate(0 4)">
          <path d="M14,11.75a.74.74,0,0,1-.53-.22L8,6.06,2.53,11.53a.75.75,0,0,1-1.06-1.06l6-6a.75.75,0,0,1,1.06,0l6,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,14,11.75Z" />
        </g>
      </Fragment>
    );
  }

  return (
    <path d="M14,11.75a.74.74,0,0,1-.53-.22L8,6.06,2.53,11.53a.75.75,0,0,1-1.06-1.06l6-6a.75.75,0,0,1,1.06,0l6,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,14,11.75Z" />
  );
}

export function IconChevron({isDouble, isCircled, direction = 'up', ...props}: Props) {
  const theme = useTheme();

  return (
    <SvgIcon
      {...props}
      css={
        direction
          ? css`
              transform: rotate(${theme.iconDirections[direction]}deg);
            `
          : undefined
      }
    >
      {getChevronPath({isDouble, isCircled, theme})}
    </SvgIcon>
  );
}
