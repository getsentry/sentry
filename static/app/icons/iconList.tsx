import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconList(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <line x1="6.75" y1="3.75" x2="13.25" y2="3.75" />
          <line x1="6.75" y1="8" x2="13.25" y2="8" />
          <line x1="6.75" y1="12.25" x2="13.25" y2="12.25" />
          <circle cx="3.25" cy="3.75" r=".5" />
          <circle cx="3.25" cy="8" r=".5" />
          <circle cx="3.25" cy="12" r=".5" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M15.19,8.75H3.7a.75.75,0,1,1,0-1.5H15.19a.75.75,0,0,1,0,1.5Z" />
          <circle cx="0.75" cy="8" r="0.75" />
          <path d="M15.19,15H3.7a.75.75,0,1,1,0-1.5H15.19a.75.75,0,1,1,0,1.5Z" />
          <circle cx="0.75" cy="14.25" r="0.75" />
          <path d="M15.19,2.53H3.7A.75.75,0,0,1,3.7,1H15.19a.75.75,0,1,1,0,1.5Z" />
          <circle cx="0.75" cy="1.75" r="0.75" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
