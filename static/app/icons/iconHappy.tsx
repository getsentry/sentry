import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconHappy(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <circle cx="8" cy="8" r="5.75" />
          <path cx="6" cy="9.75" d="m6,9.75c1,1,2.83,1,4,0" />
          <circle cx="10" cy="6.75" r=".25" />
          <circle cx="6" cy="6.75" r=".25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <circle cx="4.84" cy="6.79" r="0.99" />
          <circle cx="11.32" cy="6.79" r="0.99" />
          <path d="M8,12.27a5,5,0,0,1-4.15-2.21.75.75,0,1,1,1.24-.84,3.5,3.5,0,0,0,5.87-.08.74.74,0,0,1,1-.23.76.76,0,0,1,.23,1A5,5,0,0,1,8,12.27Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
