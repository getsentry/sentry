import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSad(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM8 9C9.66 9 11 10.34 11 12H5C5 10.34 6.34 9 8 9ZM5 6C5.55 6 6 6.45 6 7C6 7.55 5.55 8 5 8C4.45 8 4 7.55 4 7C4 6.45 4.45 6 5 6ZM11 6C11.55 6 12 6.45 12 7C12 7.55 11.55 8 11 8C10.45 8 10 7.55 10 7C10 6.45 10.45 6 11 6Z" />
      ) : (
        <Fragment>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <circle cx="4.84" cy="6.79" r="0.99" />
          <circle cx="11.32" cy="6.79" r="0.99" />
          <path d="M4.44,12.27a.72.72,0,0,1-.4-.12.76.76,0,0,1-.23-1A5,5,0,0,1,12.18,11a.75.75,0,1,1-1.24.84,3.5,3.5,0,0,0-5.87.08A.75.75,0,0,1,4.44,12.27Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
