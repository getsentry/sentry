import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconDashboard = React.forwardRef(function IconDashboard(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M5.66,15.77H1.73a1.5,1.5,0,0,1-1.5-1.5V10.34a1.5,1.5,0,0,1,1.5-1.5H5.66a1.5,1.5,0,0,1,1.5,1.5v3.93A1.5,1.5,0,0,1,5.66,15.77ZM1.73,10.34v3.93H5.66V10.34Zm3.93,0h0Z" />
      <path d="M5.66,7.16H1.73a1.5,1.5,0,0,1-1.5-1.5V1.73A1.5,1.5,0,0,1,1.73.23H5.66a1.5,1.5,0,0,1,1.5,1.5V5.66A1.5,1.5,0,0,1,5.66,7.16ZM1.73,1.73V5.66H5.66V1.73Zm3.93,0h0Z" />
      <path d="M14.27,15.77H10.34a1.5,1.5,0,0,1-1.5-1.5V10.34a1.5,1.5,0,0,1,1.5-1.5h3.93a1.5,1.5,0,0,1,1.5,1.5v3.93A1.5,1.5,0,0,1,14.27,15.77Zm-3.93-5.43v3.93h3.93V10.34Zm3.93,0h0Z" />
      <path d="M14.27,7.16H10.34a1.5,1.5,0,0,1-1.5-1.5V1.73a1.5,1.5,0,0,1,1.5-1.5h3.93a1.5,1.5,0,0,1,1.5,1.5V5.66A1.5,1.5,0,0,1,14.27,7.16ZM10.34,1.73V5.66h3.93V1.73Zm3.93,0h0Z" />
    </SvgIcon>
  );
});

IconDashboard.displayName = 'IconDashboard';

export {IconDashboard};
