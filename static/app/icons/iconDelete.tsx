import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconDelete(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m3.75,4.75h8.5v7.5c0,.55-.45,1-1,1h-6.5c-.55,0-1-.45-1-1v-7.5h0Z" />
          <line x1="2.75" y1="4.75" x2="13.25" y2="4.75" />
          <line x1="6.5" y1="7.25" x2="6.5" y2="10.75" />
          <line x1="9.5" y1="7.25" x2="9.5" y2="10.75" />
          <path d="m4.75,4.5l1.45-2.07c.19-.27.49-.43.82-.43h1.96c.33,0,.63.16.82.43l1.45,2.07" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M14.71,3.94H1.29a.75.75,0,0,1,0-1.5H14.71a.75.75,0,0,1,0,1.5Z" />
          <path d="M12.69,15.94H3.31a1.75,1.75,0,0,1-1.75-1.75v-11h1.5v11a.25.25,0,0,0,.25.25h9.38a.25.25,0,0,0,.25-.25v-11h1.5v11A1.75,1.75,0,0,1,12.69,15.94Z" />
          <path d="M5,13a.74.74,0,0,1-.75-.75V6.14a.75.75,0,0,1,1.5,0v6.1A.75.75,0,0,1,5,13Z" />
          <path d="M8,13a.75.75,0,0,1-.75-.75V6.14a.75.75,0,0,1,1.5,0v6.1A.75.75,0,0,1,8,13Z" />
          <path d="M11.05,13a.75.75,0,0,1-.75-.75V6.14a.75.75,0,0,1,1.5,0v6.1A.74.74,0,0,1,11.05,13Z" />
          <path d="M10.51,3.47l-.81-2H6.3l-.81,2L4.1,2.91,5,.77A1.26,1.26,0,0,1,6.13,0H9.87A1.26,1.26,0,0,1,11,.77l.87,2.14Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
