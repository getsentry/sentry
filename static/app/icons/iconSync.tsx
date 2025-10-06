import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSync(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m13.25,8c0-3.05-2.47-5.52-5.52-5.52-1.99,0-3.74,1.06-4.71,2.64" />
          <polyline points="2.73 2.5 2.73 5.5 5.73 5.5" />
          <path d="m2.5,7.98c0,3.05,2.47,5.52,5.52,5.52,1.99,0,3.74-1.06,4.71-2.64" />
          <polyline points="13.02 13.48 13.02 10.48 10.02 10.48" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M14.42,15.9a.75.75,0,0,1-.75-.75V11.89H10.41a.75.75,0,0,1,0-1.5h4a.75.75,0,0,1,.75.75v4A.76.76,0,0,1,14.42,15.9Z" />
          <path d="M8,15.9A7.91,7.91,0,0,1,.11,8a.76.76,0,0,1,.75-.75A.76.76,0,0,1,1.61,8a6.39,6.39,0,0,0,12.14,2.81.75.75,0,0,1,1.35.66A7.86,7.86,0,0,1,8,15.9Z" />
          <path d="M5.61,5.61h-4a.75.75,0,0,1-.75-.75v-4a.75.75,0,0,1,1.5,0V4.11H5.61a.75.75,0,0,1,0,1.5Z" />
          <path d="M15.15,8.75A.76.76,0,0,1,14.4,8,6.39,6.39,0,0,0,2.26,5.19.75.75,0,0,1,.91,4.53,7.9,7.9,0,0,1,15.9,8,.75.75,0,0,1,15.15,8.75Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
