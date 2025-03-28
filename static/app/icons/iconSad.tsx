import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconSad({ref, ...props}: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} ref={ref} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <circle className="cls-1" cx="8" cy="8" r="5.75" />
          <path className="cls-1" d="m10,10.25c-1-1-2.83-1-4,0" />
          <circle className="cls-1" cx="10" cy="6.75" r=".25" />
          <circle className="cls-1" cx="6" cy="6.75" r=".25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <circle cx="4.84" cy="6.79" r="0.99" />
          <circle cx="11.32" cy="6.79" r="0.99" />
          <path d="M4.44,12.27a.72.72,0,0,1-.4-.12.76.76,0,0,1-.23-1A5,5,0,0,1,12.18,11a.75.75,0,1,1-1.24.84,3.5,3.5,0,0,0-5.87.08A.75.75,0,0,1,4.44,12.27Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}

IconSad.displayName = 'IconSad';

export {IconSad};
