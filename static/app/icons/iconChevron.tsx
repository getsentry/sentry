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
        <path d="M12.7948 7.73534C13.0792 8.03648 13.0656 8.5105 12.7645 8.79491C12.4633 9.07906 11.9892 9.06568 11.7049 8.76463L7.99984 4.8408L4.29476 8.76463C4.01033 9.06553 3.53624 9.07924 3.23519 8.79491C2.93433 8.51056 2.92082 8.03642 3.20492 7.73534L7.45492 3.23534C7.5965 3.08543 7.79365 3.00011 7.99984 2.99998C8.2061 2.99998 8.40309 3.08544 8.54476 3.23534L12.7948 7.73534ZM12.7948 11.7353C13.0792 12.0365 13.0656 12.5105 12.7645 12.7949C12.4633 13.0791 11.9892 13.0657 11.7049 12.7646L7.99984 8.8408L4.29476 12.7646C4.01033 13.0655 3.53624 13.0792 3.23519 12.7949C2.93433 12.5106 2.92082 12.0364 3.20492 11.7353L7.45492 7.23534C7.5965 7.08543 7.79365 7.00011 7.99984 6.99998C8.2061 6.99998 8.40309 7.08544 8.54476 7.23534L12.7948 11.7353Z" />
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
      kind="path"
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
