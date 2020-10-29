import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconOpen = React.forwardRef(function IconOpen(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
      <path d="M11.13,10.63a.74.74,0,0,1-.75-.75V5.62H6.12a.75.75,0,0,1,0-1.5h5a.76.76,0,0,1,.75.75v5A.75.75,0,0,1,11.13,10.63Z" />
      <path d="M4.87,11.88a.79.79,0,0,1-.53-.22.75.75,0,0,1,0-1.06L10.6,4.34A.75.75,0,0,1,11.66,5.4L5.4,11.66A.77.77,0,0,1,4.87,11.88Z" />
    </SvgIcon>
  );
});

IconOpen.displayName = 'IconOpen';

export {IconOpen};
