import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMeh(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <circle cx="8" cy="8" r="5.75" />
          <line x1="5.5" y1="9.75" x2="10.5" y2="9.75" />
          <circle cx="10" cy="6.75" r=".25" />
          <circle cx="6" cy="6.75" r=".25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <circle cx="4.84" cy="6.79" r="0.99" />
          <circle cx="11.32" cy="6.79" r="0.99" />
          <path d="M12.32,10.78H3.85a.75.75,0,1,1,0-1.5h8.47a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
