import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconExpand = React.forwardRef(function IconExpand(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M12.69,6.24A.74.74,0,0,1,12.16,6L8,1.87,3.84,6A.74.74,0,0,1,2.78,6,.75.75,0,0,1,2.78,5L7.47.27a.75.75,0,0,1,1.06,0L13.22,5a.75.75,0,0,1,0,1.06A.74.74,0,0,1,12.69,6.24Z" />
      <path d="M8,16a.75.75,0,0,1-.53-.22L2.78,11.09A.75.75,0,1,1,3.84,10L8,14.19,12.16,10a.75.75,0,1,1,1.06,1.06L8.53,15.78A.75.75,0,0,1,8,16Z" />
    </SvgIcon>
  );
});

IconExpand.displayName = 'IconExpand';

export {IconExpand};
