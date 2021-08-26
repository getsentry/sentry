import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconGoogle = React.forwardRef(function IconGoogle(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M1,11.58A8,8,0,0,0,8.17,16a7.77,7.77,0,0,0,5.28-1.92c1.78-1.62,2.75-4.19,2.25-7.53H8.18V9.64h4.38a4.11,4.11,0,0,1-1.64,2.47,4.76,4.76,0,0,1-2.75.76A4.8,4.8,0,0,1,3.63,9.55,4.66,4.66,0,0,1,3.38,8a4.66,4.66,0,0,1,.25-1.55A4.8,4.8,0,0,1,8.17,3.13a4.44,4.44,0,0,1,3.07,1.21l2.29-2.27A7.92,7.92,0,0,0,8.17,0,8,8,0,0,0,1,11.58Z" />
    </SvgIcon>
  );
});

IconGoogle.displayName = 'IconGoogle';

export {IconGoogle};
