import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconCollapse = React.forwardRef(function IconCollapse(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M12.69,16a.74.74,0,0,1-.53-.22L8,11.62,3.84,15.78a.74.74,0,0,1-1.06,0,.75.75,0,0,1,0-1.06L7.47,10a.77.77,0,0,1,1.06,0l4.69,4.69a.75.75,0,0,1,0,1.06A.74.74,0,0,1,12.69,16Z" />
      <path d="M8,6.24A.74.74,0,0,1,7.47,6L2.78,1.33A.75.75,0,0,1,3.84.27L8,4.43,12.16.27a.75.75,0,1,1,1.06,1.06L8.53,6A.74.74,0,0,1,8,6.24Z" />
    </SvgIcon>
  );
});

IconCollapse.displayName = 'IconCollapse';

export {IconCollapse};
