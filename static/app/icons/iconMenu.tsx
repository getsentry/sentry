import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMenu(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <line x1="2.75" y1="4" x2="13.25" y2="4" />
          <line x1="2.75" y1="8" x2="13.25" y2="8" />
          <line x1="2.75" y1="12" x2="13.25" y2="12" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M15.19,2.53H.81A.75.75,0,0,1,.81,1H15.19a.75.75,0,1,1,0,1.5Z" />
          <path d="M15.19,15H.81a.75.75,0,0,1,0-1.5H15.19a.75.75,0,1,1,0,1.5Z" />
          <path d="M15.19,8.75H.81a.75.75,0,1,1,0-1.5H15.19a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
