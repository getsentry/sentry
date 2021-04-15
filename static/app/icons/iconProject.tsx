import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconProject = React.forwardRef(function IconProject(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M5.43,11.92a.73.73,0,0,1-.53-.22L3,9.82A.75.75,0,0,1,3,8.76L4.9,6.88A.75.75,0,0,1,6,7.94L4.61,9.29,6,10.64A.75.75,0,0,1,6,11.7.74.74,0,0,1,5.43,11.92Z" />
      <path d="M10.58,11.92a.74.74,0,0,1-.53-.22.75.75,0,0,1,0-1.06L11.4,9.29,10.05,7.94a.75.75,0,0,1,1.06-1.06L13,8.76a.74.74,0,0,1,0,1.06L11.11,11.7A.71.71,0,0,1,10.58,11.92Z" />
      <path d="M15.26,16H.76A.75.75,0,0,1,0,15.26V.76A.74.74,0,0,1,.76,0H5.12A2.75,2.75,0,0,1,6.77.56L8.51,1.87a1.3,1.3,0,0,0,.75.25h6a.76.76,0,0,1,.75.75V15.26A.76.76,0,0,1,15.26,16ZM1.51,14.51h13V3.62H9.26a2.75,2.75,0,0,1-1.65-.55L5.87,1.76h0a1.3,1.3,0,0,0-.75-.25H1.51Z" />
    </SvgIcon>
  );
});

IconProject.displayName = 'IconProject';

export {IconProject};
