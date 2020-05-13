import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconGrabbable = React.forwardRef<SVGSVGElement, Props>((props: Props, ref) => (
  <SvgIcon {...props} ref={ref}>
    <circle cx="4.73" cy="8" r="1.31" />
    <circle cx="4.73" cy="1.31" r="1.31" />
    <circle cx="11.27" cy="8" r="1.31" />
    <circle cx="11.27" cy="1.31" r="1.31" />
    <circle cx="4.73" cy="14.69" r="1.31" />
    <circle cx="11.27" cy="14.69" r="1.31" />
  </SvgIcon>
));

export {IconGrabbable};
