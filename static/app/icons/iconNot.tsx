import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconNot(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <circle cx="8" cy="8" r="5.75" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </Fragment>
      ) : (
        <path d="M8,0a8,8,0,1,0,8,8A8,8,0,0,0,8,0ZM1.53,8A6.47,6.47,0,0,1,8,1.53a6.4,6.4,0,0,1,4,1.4L2.93,12A6.4,6.4,0,0,1,1.53,8ZM8,14.47a6.38,6.38,0,0,1-4-1.4L13.07,4a6.38,6.38,0,0,1,1.4,4A6.47,6.47,0,0,1,8,14.47Z" />
      )}
    </SvgIcon>
  );
}
