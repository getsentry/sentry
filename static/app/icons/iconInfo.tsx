import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconInfo(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <polyline points="7.25 7.75 8.25 7.75 8.25 10.75" />
          <circle cx="8" cy="8" r="5.75" />
          <circle cx="7.75" cy="5.25" r=".25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8,11.78A.74.74,0,0,1,7.24,11V7a.75.75,0,0,1,1.5,0v4A.75.75,0,0,1,8,11.78Z" />
          <circle cx="8" cy="4.78" r="0.76" />
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}

IconInfo.displayName = 'IconInfo';

export {IconInfo};
