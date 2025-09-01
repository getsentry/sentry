import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconInput(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect x="3" y="3" width="10" height="10" rx="1" ry="1" />
          <line x1="5.5" y1="5.5" x2="7.5" y2="5.5" />
          <line x1="5.5" y1="10.5" x2="7.5" y2="10.5" />
          <line x1="6.5" y1="5.5" x2="6.5" y2="10.5" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
          <rect x="3.15" y="3.58" width="1.5" height="8.83" />
          <path d="M4.9,13.17h-2a.75.75,0,0,1,0-1.5h2a.75.75,0,0,1,0,1.5Z" />
          <path d="M4.9,4.33h-2a.75.75,0,0,1,0-1.5h2a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
