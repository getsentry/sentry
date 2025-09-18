import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCalendar(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect x="2.75" y="3.5" width="10.5" height="9.75" rx="1" ry="1" />
          <line x1="2.75" y1="7" x2="13.25" y2="7" />
          <line x1="5.25" y1="2.75" x2="5.25" y2="4.25" />
          <line x1="10.75" y1="2.75" x2="10.75" y2="4.25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V4.18A2.75,2.75,0,0,1,2.75,1.43h10.5A2.75,2.75,0,0,1,16,4.18v9.07A2.75,2.75,0,0,1,13.25,16ZM2.75,2.93A1.25,1.25,0,0,0,1.5,4.18v9.07A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V4.18a1.25,1.25,0,0,0-1.25-1.25Z" />
          <path d="M4.36,4.43a.76.76,0,0,1-.75-.75V.77a.75.75,0,0,1,1.5,0V3.68A.75.75,0,0,1,4.36,4.43Z" />
          <path d="M11.64,4.43a.75.75,0,0,1-.75-.75V.77a.75.75,0,1,1,1.5,0V3.68A.76.76,0,0,1,11.64,4.43Z" />
          <rect x="0.75" y="5.8" width="14.5" height="1.5" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
