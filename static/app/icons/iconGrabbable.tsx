import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconGrabbable = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <circle cx="4.73" cy="8" r="1.31" />
      <circle cx="4.73" cy="1.31" r="1.31" />
      <circle cx="11.27" cy="8" r="1.31" />
      <circle cx="11.27" cy="1.31" r="1.31" />
      <circle cx="4.73" cy="14.69" r="1.31" />
      <circle cx="11.27" cy="14.69" r="1.31" />
    </SvgIcon>
  );
});

IconGrabbable.displayName = 'IconGrabbable';

export {IconGrabbable};
