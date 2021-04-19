import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconLink = React.forwardRef(function IconLink(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M4.58,9.5a.71.71,0,0,1-.53-.22L1.16,6.4l0,0h0L1,6.22a.49.49,0,0,1-.11-.14A3.68,3.68,0,0,1,6.06.9.49.49,0,0,1,6.2,1L9.26,4.07a.74.74,0,0,1,0,1.06.75.75,0,0,1-1.06,0L5.32,2.24l0,0A2.19,2.19,0,0,0,2.18,5.29L5.11,8.22a.75.75,0,0,1,0,1.06A.74.74,0,0,1,4.58,9.5Z" />
      <path d="M12.21,15.91A3.68,3.68,0,0,1,9.9,15.1L9.75,15l-3-3.06a.74.74,0,0,1,0-1.06.75.75,0,0,1,1.06,0l2.89,2.9h0a2.18,2.18,0,0,0,3.09-3.09h0l-2.9-2.9a.77.77,0,0,1,0-1.07.75.75,0,0,1,1.06,0L15,9.77l.11.15a3.69,3.69,0,0,1-2.87,6Z" />
      <path d="M11.92,12.69a.74.74,0,0,1-.53-.22L3.5,4.58A.75.75,0,1,1,4.56,3.52l7.89,7.89a.74.74,0,0,1,0,1.06A.71.71,0,0,1,11.92,12.69Z" />
    </SvgIcon>
  );
});

IconLink.displayName = 'IconLink';

export {IconLink};
