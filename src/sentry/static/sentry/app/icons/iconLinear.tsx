import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconLinear = React.forwardRef(function IconLinear(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M.1,9.35,6.65,15.9A8,8,0,0,1,.1,9.35Z" />
      <path d="M0,7.57,8.43,16a8.7,8.7,0,0,0,1.46-.21L.21,6.11A8.7,8.7,0,0,0,0,7.57Z" />
      <path d="M.63,4.85,11.15,15.37a8.86,8.86,0,0,0,1.1-.58l-11-11A8.86,8.86,0,0,0,.63,4.85Z" />
      <path d="M1.92,2.79A8,8,0,1,1,13.21,14.08Z" />
    </SvgIcon>
  );
});

IconLinear.displayName = 'IconLinear';

export {IconLinear};
