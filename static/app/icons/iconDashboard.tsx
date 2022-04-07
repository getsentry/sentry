import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconDashboard = React.forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M5.66,16H1.5A1.5,1.5,0,0,1,0,14.5v-13A1.5,1.5,0,0,1,1.5,0H5.66a1.5,1.5,0,0,1,1.5,1.5v13A1.5,1.5,0,0,1,5.66,16ZM1.5,1.52v13H5.66v-13Z" />
      <path d="M14.5,16H10.34a1.5,1.5,0,0,1-1.5-1.5V11.79a1.5,1.5,0,0,1,1.5-1.5H14.5a1.5,1.5,0,0,1,1.5,1.5V14.5A1.5,1.5,0,0,1,14.5,16Zm0-4.21H10.34V14.5H14.5Z" />
      <path d="M14.5,8.62H10.34a1.5,1.5,0,0,1-1.5-1.5V1.5A1.5,1.5,0,0,1,10.34,0H14.5A1.5,1.5,0,0,1,16,1.5V7.12A1.5,1.5,0,0,1,14.5,8.62ZM10.34,1.5V7.12H14.5V1.5Z" />
    </SvgIcon>
  );
});

IconDashboard.displayName = 'IconDashboard';

export {IconDashboard};
