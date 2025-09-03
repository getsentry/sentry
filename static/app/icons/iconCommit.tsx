import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCommit(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <circle cx="8" cy="8" r="2.5" />
          <line x1="10.5" y1="8" x2="14" y2="8" />
          <line x1="5.5" y1="8" x2="2" y2="8" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8,11.91A3.91,3.91,0,1,1,11.91,8,3.91,3.91,0,0,1,8,11.91ZM8,5.59A2.41,2.41,0,1,0,10.41,8,2.41,2.41,0,0,0,8,5.59Z" />
          <path d="M15.23,8.75H11.16a.75.75,0,0,1,0-1.5h4.07a.75.75,0,0,1,0,1.5Z" />
          <path d="M4.84,8.75H.77a.75.75,0,1,1,0-1.5H4.84a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
