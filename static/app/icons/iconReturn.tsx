import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconReturn = React.forwardRef(function IconReturn(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M3.89,15.06a.74.74,0,0,1-.53-.22L.24,11.72a.75.75,0,0,1,0-1.06L3.36,7.55a.74.74,0,0,1,1.06,0,.75.75,0,0,1,0,1.06L1.83,11.19l2.59,2.59a.75.75,0,0,1,0,1.06A.74.74,0,0,1,3.89,15.06Z" />
      <path d="M15,11.94H.77a.75.75,0,1,1,0-1.5H14.21V2.88H4.49a.75.75,0,0,1,0-1.5H15a.75.75,0,0,1,.75.75v9.06A.74.74,0,0,1,15,11.94Z" />{' '}
    </SvgIcon>
  );
});

IconReturn.displayName = 'IconReturn';

export {IconReturn};
