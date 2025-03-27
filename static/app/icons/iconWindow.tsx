import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconWindow({ref, ...props}: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} ref={ref} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1" ry="1" />
          <circle cx="8.5" cy="5.5" r=".25" />
          <circle cx="5.5" cy="5.5" r=".25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
          <rect x="0.75" y="4.62" width="14.5" height="1.5" />
          <circle cx="3.17" cy="3.18" r="0.76" />
          <circle cx="5.47" cy="3.18" r="0.76" />
          <circle cx="7.76" cy="3.18" r="0.76" />
        </Fragment>
      )}
    </SvgIcon>
  );
}

IconWindow.displayName = 'IconWindow';

export {IconWindow};
