import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconUpgrade(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1" ry="1" />
          <polyline points="5.46 7.82 8.03 5.25 10.67 7.89" />
          <line x1="8" y1="10.75" x2="8" y2="5.27" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M11.54,7.5A.79.79,0,0,1,11,7.28l-3-3-3,3a.75.75,0,0,1-1.06,0,.74.74,0,0,1,0-1.06L7.47,2.67a.77.77,0,0,1,1.06,0l3.54,3.55a.74.74,0,0,1,0,1.06A.77.77,0,0,1,11.54,7.5Z" />
          <path d="M8,12.8a.76.76,0,0,1-.75-.75V3.2a.75.75,0,1,1,1.5,0v8.85A.76.76,0,0,1,8,12.8Z" />
          <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
