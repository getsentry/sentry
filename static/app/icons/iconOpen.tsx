import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconOpen(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1" ry="1" />
          <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" />
          <polyline points="6.25 5.38 10.5 5.5 10.5 9.75" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
          <path d="M11.13,10.63a.74.74,0,0,1-.75-.75V5.62H6.12a.75.75,0,0,1,0-1.5h5a.76.76,0,0,1,.75.75v5A.75.75,0,0,1,11.13,10.63Z" />
          <path d="M4.87,11.88a.79.79,0,0,1-.53-.22.75.75,0,0,1,0-1.06L10.6,4.34A.75.75,0,0,1,11.66,5.4L5.4,11.66A.77.77,0,0,1,4.87,11.88Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
