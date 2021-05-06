import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconLaptop = React.forwardRef(function IconLaptop(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M14.27,16H1.77a1.77,1.77,0,0,1-1.35-.63,1.8,1.8,0,0,1-.37-1.45l.76-4V1.79A1.75,1.75,0,0,1,2.56,0H13.48a1.75,1.75,0,0,1,1.75,1.75V9.93l.76,4A1.74,1.74,0,0,1,14.27,16ZM2.56,1.54a.25.25,0,0,0-.25.25V10a.71.71,0,0,1,0,.14l-.77,4a.24.24,0,0,0,.05.21.26.26,0,0,0,.19.09h12.5a.26.26,0,0,0,.19-.09.24.24,0,0,0,0-.21l-.77-4a.71.71,0,0,1,0-.14V1.79a.25.25,0,0,0-.25-.25Z" />
      <circle cx="5.73" cy="5.4" r="0.76" />
      <circle cx="8.02" cy="5.4" r="0.76" />
      <circle cx="10.31" cy="5.4" r="0.76" />
      <path d="M14.48,10.76H1.56a.75.75,0,0,1,0-1.5H14.48a.75.75,0,0,1,0,1.5Z" />
    </SvgIcon>
  );
});

IconLaptop.displayName = 'IconLaptop';

export {IconLaptop};
