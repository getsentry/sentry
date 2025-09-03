import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSearch(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <circle className="cls-1" cx="7" cy="7" r="4.25" />
          <line className="cls-1" x1="13.25" y1="13.25" x2="10" y2="10" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M6,12A6,6,0,1,1,12,6,6,6,0,0,1,6,12ZM6,1.54A4.46,4.46,0,1,0,10.45,6,4.46,4.46,0,0,0,6,1.54Z" />
          <path d="M15.2,16a.74.74,0,0,1-.53-.22L9.14,10.2A.75.75,0,0,1,10.2,9.14l5.53,5.53a.75.75,0,0,1,0,1.06A.74.74,0,0,1,15.2,16Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
