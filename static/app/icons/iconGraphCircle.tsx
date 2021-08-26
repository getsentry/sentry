import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconGraphCircle = React.forwardRef(function IconGraphCircle(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M13.1,15.09a.74.74,0,0,1-.5-.2l-6-5.48a.76.76,0,0,1-.24-.55V.76A.76.76,0,0,1,7.14,0a8.85,8.85,0,0,1,6.52,14.84A.76.76,0,0,1,13.1,15.09ZM7.89,8.53,13,13.25A7.34,7.34,0,0,0,7.89,1.55Z" />
      <path d="M7.14,16a7.13,7.13,0,0,1,0-14.26v1.5a5.63,5.63,0,1,0,4.15,9.44l1.1,1A7.12,7.12,0,0,1,7.14,16Z" />
    </SvgIcon>
  );
});

IconGraphCircle.displayName = 'IconGraphCircle';

export {IconGraphCircle};
