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
        <g>
          <path d="M3.25 7.84001L7.29 3.80001C7.68 3.41001 8.31 3.41001 8.7 3.80001L12.75 7.84001" />
          <path d="M3.25 12.25L7.29 8.21001C7.68 7.82001 8.31 7.82001 8.7 8.21001L12.74 12.25" />
        </g>
      );
    }
    return (
      <path d="M3.25 10L7.29 5.96001C7.68 5.57001 8.31 5.57001 8.7 5.96001L12.74 10" />
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
      kind={theme.isChonk ? 'stroke' : 'path'}
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
