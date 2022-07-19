import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconJira = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.83,7.57l0,0h0L8.69.67,8,0,2.64,5.18.19,7.55a.63.63,0,0,0,0,.88l0,0,4.9,4.73L8,16l5.36-5.18.08-.08,2.37-2.29A.63.63,0,0,0,15.83,7.57ZM8,10.37H8L5.55,8,8,5.63,10.45,8Z" />
    </SvgIcon>
  );
});

IconJira.displayName = 'IconJira';

export {IconJira};
