import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconVercel = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M13.25,0H2.75A2.75,2.75,0,0,0,0,2.76v10.5A2.75,2.75,0,0,0,2.75,16h10.5A2.75,2.75,0,0,0,16,13.26V2.76A2.75,2.75,0,0,0,13.25,0ZM3.74,11.28,8,3.86l4.26,7.42Z" />
    </SvgIcon>
  );
});

IconVercel.displayName = 'IconVercel';

export {IconVercel};
