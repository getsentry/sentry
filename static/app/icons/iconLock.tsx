import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  locked?: boolean;
}

export function IconLock({locked = false, ...props}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        locked ? (
          <Fragment>
            <rect x="4.12" y="7.25" width="7.75" height="6" rx="1" ry="1" />
            <line x1="8" y1="9.75" x2="8" y2="10.75" />
            <path d="m5.25,7.25v-1.75c0-1.52,1.23-2.75,2.75-2.75h0c1.52,0,2.75,1.23,2.75,2.75v1.75" />
          </Fragment>
        ) : (
          <Fragment>
            <rect x="2.75" y="7.25" width="7.75" height="6" rx="1" ry="1" />
            <line x1="6.62" y1="9.75" x2="6.62" y2="10.75" />
            <path d="m7.75,7.25v-1.75c0-1.52,1.23-2.75,2.75-2.75h0c1.52,0,2.75,1.23,2.75,2.75v1.75" />
          </Fragment>
        )
      ) : locked ? (
        <Fragment>
          <path d="M11.67,7.94a.75.75,0,0,1-.75-.75V4.34a2.84,2.84,0,1,0-5.67,0V7.19a.75.75,0,1,1-1.5,0V4.34a4.34,4.34,0,1,1,8.67,0V7.19A.76.76,0,0,1,11.67,7.94" />
          <path d="M14.72,16H1.44a.76.76,0,0,1-.75-.75V7.19a.75.75,0,0,1,.75-.75H14.72a.75.75,0,0,1,.75.75v8.06A.76.76,0,0,1,14.72,16ZM2.19,14.5H14V7.94H2.19Z" />
          <path d="M8.08,12.94a.76.76,0,0,1-.75-.75V10.05a.75.75,0,0,1,1.5,0v2.14A.75.75,0,0,1,8.08,12.94Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M4.5,7.94a.75.75,0,0,1-.75-.75V4.34a4.34,4.34,0,0,1,8.5-1.21.76.76,0,0,1-.52.93.74.74,0,0,1-.92-.51,2.84,2.84,0,0,0-5.56.79V7.19A.76.76,0,0,1,4.5,7.94Z" />
          <path d="M14.72,16H1.44a.76.76,0,0,1-.75-.75V7.19a.75.75,0,0,1,.75-.75H14.72a.75.75,0,0,1,.75.75v8.06A.76.76,0,0,1,14.72,16ZM2.19,14.5H14V7.94H2.19Z" />
          <path d="M8.08,12.94a.76.76,0,0,1-.75-.75V10.05a.75.75,0,0,1,1.5,0v2.14A.75.75,0,0,1,8.08,12.94Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
