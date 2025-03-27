import {forwardRef, Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconTelescope = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  const theme = useTheme();
  return (
    <SvgIcon {...props} ref={ref} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <line x1="8" y1="9.5" x2="6.25" y2="13.75" />
          <line x1="8" y1="9.5" x2="9.75" y2="13.75" />
          <path
            d="m5.83,4.87h4.25v4.5h-4.25c-.55,0-1-.45-1-1v-2.5c0-.55.45-1,1-1Z"
            transform="translate(-1.59 2.17) rotate(-15)"
          />
          <rect
            x="9.93"
            y="2.8"
            width="3"
            height="6.5"
            rx="1"
            ry="1"
            transform="translate(-1.18 3.17) rotate(-15)"
          />
          <path
            d="m3.21,6.91h1.75v2.5h-1.75c-.55,0-1-.45-1-1v-.5c0-.55.45-1,1-1Z"
            transform="translate(-1.99 1.21) rotate(-15)"
          />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M4.66,16a.76.76,0,0,1-.73-1l1.24-4.38a.75.75,0,1,1,1.45.41L5.38,15.46A.77.77,0,0,1,4.66,16Z" />
          <path d="M11,16a.77.77,0,0,1-.63-.33L6.8,10.4a.75.75,0,0,1,1.25-.83l3.53,5.27a.74.74,0,0,1-.21,1A.71.71,0,0,1,11,16Z" />
          <path d="M3.68,12.77A1.6,1.6,0,0,1,2.29,12L.57,9a1.63,1.63,0,0,1,.62-2.22L6.74,3.56l.75,1.3L2,8.09c-.08.05-.11.13-.09.17l1.73,3a.24.24,0,0,0,.19,0L9.32,8l.75,1.3L4.53,12.54A1.72,1.72,0,0,1,3.68,12.77Z" />
          <path d="M10.88,10.53A1.68,1.68,0,0,1,9.43,9.7L6.12,4a1.67,1.67,0,0,1,.61-2.29L9.29.23a1.7,1.7,0,0,1,2.28.6l3.31,5.7a1.66,1.66,0,0,1,.17,1.27,1.62,1.62,0,0,1-.78,1L11.71,10.3A1.62,1.62,0,0,1,10.88,10.53Zm-.75-9L7.48,3a.16.16,0,0,0-.08.1.19.19,0,0,0,0,.13l3.31,5.7A.17.17,0,0,0,11,9l2.56-1.48a.18.18,0,0,0,.08-.11.13.13,0,0,0,0-.12l-3.3-5.71A.18.18,0,0,0,10.13,1.5Z" />
          <path d="M14.24,6.82,13.4,5.58a1.7,1.7,0,0,0-1-3.1,1.59,1.59,0,0,0-.74.18L11,1.31A3.14,3.14,0,0,1,12.45,1a3.2,3.2,0,0,1,1.79,5.84Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
});

IconTelescope.displayName = 'IconTelescope';

export {IconTelescope};
