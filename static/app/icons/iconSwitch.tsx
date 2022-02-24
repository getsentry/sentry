import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconSwitch = React.forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M4.24,15.49a.75.75,0,0,1-.53-.22L.83,12.39a.75.75,0,0,1,0-1.06L3.71,8.46a.74.74,0,0,1,1.06,0,.75.75,0,0,1,0,1.06L2.42,11.86l2.35,2.35a.75.75,0,0,1,0,1.06A.79.79,0,0,1,4.24,15.49Z" />
      <path d="M14.66,12.61H1.36a.75.75,0,1,1,0-1.5h13.3a.75.75,0,0,1,0,1.5Z" />
      <path d="M11.78,7.87a.74.74,0,0,1-.53-.22.75.75,0,0,1,0-1.06L13.6,4.25,11.25,1.9A.75.75,0,0,1,12.31.84l2.88,2.88a.75.75,0,0,1,0,1.06L12.31,7.65A.74.74,0,0,1,11.78,7.87Z" />
      <path d="M14.66,5H1.36a.75.75,0,0,1,0-1.5h13.3a.75.75,0,0,1,0,1.5Z" />
    </SvgIcon>
  );
});

IconSwitch.displayName = 'IconSwitch';

export {IconSwitch};
