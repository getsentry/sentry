import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconTable(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1" ry="1" />
          <line x1="2.75" y1="6.25" x2="13.25" y2="6.25" />
          <line x1="5.5" y1="2.75" x2="5.5" y2="13.25" />
          <line x1="3" y1="9.75" x2="13.25" y2="9.75" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.25,16H2.75c-1.52,0-2.75-1.23-2.75-2.75V2.75C0,1.23,1.23,0,2.75,0h10.5c1.52,0,2.75,1.23,2.75,2.75v10.5c0,1.52-1.23,2.75-2.75,2.75ZM2.75,1.5c-.69,0-1.25.56-1.25,1.25v10.5c0,.69.56,1.25,1.25,1.25h10.5c.69,0,1.25-.56,1.25-1.25V2.75c0-.69-.56-1.25-1.25-1.25H2.75Z" />
          <rect x=".75" y="5.08" width="14.5" height="1.5" />
          <rect x="9.67" y=".75" width="1.5" height="14.5" />
          <rect x=".75" y="8.16" width="14.5" height="1.5" />
          <rect x=".75" y="11.23" width="14.5" height="1.5" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
