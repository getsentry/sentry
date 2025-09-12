import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconTerminal(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m5.25,5.25l1.15,1.15c.2.2.2.51,0,.71l-1.15,1.15" />
          <rect x="2.75" y="2.75" width="10.5" height="10.25" rx="1" ry="1" />
          <line x1="8.5" y1="8.5" x2="10.5" y2="8.5" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M.76,13.54a.74.74,0,0,1-.53-.22.75.75,0,0,1,0-1.06L4.75,7.74.23,3.22A.75.75,0,0,1,1.29,2.16L6.34,7.21a.75.75,0,0,1,0,1.06l-5,5.05A.74.74,0,0,1,.76,13.54Z" />
          <path d="M15.24,13.8H6.79a.75.75,0,1,1,0-1.5h8.45a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
