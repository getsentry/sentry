import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconWarning(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m7.63,3L2.29,12.25c-.19.33.05.75.43.75h10.68c.38,0,.63-.42.43-.75L8.5,3c-.19-.33-.67-.33-.87,0Z" />
          <line x1="8" y1="6.5" x2="8" y2="8.5" />
          <circle cx="8" cy="10.62" r=".12" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.87,15.26H2.13A2.1,2.1,0,0,1,0,13.16a2.07,2.07,0,0,1,.27-1L6.17,1.8a2.1,2.1,0,0,1,1.27-1,2.11,2.11,0,0,1,2.39,1L15.7,12.11a2.1,2.1,0,0,1-1.83,3.15ZM8,2.24a.44.44,0,0,0-.16,0,.58.58,0,0,0-.37.28L1.61,12.86a.52.52,0,0,0-.08.3.6.6,0,0,0,.6.6H13.87a.54.54,0,0,0,.3-.08.59.59,0,0,0,.22-.82L8.53,2.54h0a.61.61,0,0,0-.23-.22A.54.54,0,0,0,8,2.24Z" />
          <path d="M8,10.37a.75.75,0,0,1-.75-.75V5.92a.75.75,0,0,1,1.5,0v3.7A.74.74,0,0,1,8,10.37Z" />
          <circle cx="8" cy="11.79" r="0.76" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
