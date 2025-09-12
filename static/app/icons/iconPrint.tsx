import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconPrint(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m5.25,8.5h5.5v4.5c0,.28-.22.5-.5.5h-4.5c-.28,0-.5-.22-.5-.5v-4.5h0Z" />
          <path
            d="m5.25,2.5h5.5v2.25c0,.28-.22.5-.5.5h-4.5c-.28,0-.5-.22-.5-.5v-2.25h0Z"
            transform="translate(16 7.75) rotate(180)"
          />
          <path d="m10.75,11.5h1.5c.55,0,1-.45,1-1v-4.25c0-.55-.45-1-1-1H3.75c-.55,0-1,.45-1,1v4.25c0,.55.45,1,1,1h1.5" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.12,16H2.88a.76.76,0,0,1-.75-.75V6a.76.76,0,0,1,.75-.75H13.12a.76.76,0,0,1,.75.75v9.21A.76.76,0,0,1,13.12,16Zm-9.49-1.5h8.74V6.77H3.63Z" />
          <path d="M13.25,12.12h-.13v-1.5h.13A1.25,1.25,0,0,0,14.5,9.38V2.75A1.25,1.25,0,0,0,13.25,1.5H2.75A1.25,1.25,0,0,0,1.5,2.75V9.38a1.25,1.25,0,0,0,1.25,1.24h.13v1.5H2.75A2.75,2.75,0,0,1,0,9.38V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75V9.38A2.75,2.75,0,0,1,13.25,12.12Z" />
          <path d="M11.08,10H4.92a.75.75,0,0,1,0-1.5h6.16a.75.75,0,1,1,0,1.5Z" />
          <path d="M4.43,3.61H2.88a.75.75,0,0,1,0-1.5H4.43a.75.75,0,0,1,0,1.5Z" />
          <path d="M11.08,12.8H4.92a.75.75,0,1,1,0-1.5h6.16a.75.75,0,1,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
