import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconAsana = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,.61A3.48,3.48,0,1,1,4.52,4.09,3.48,3.48,0,0,1,8,.61Z" />
      <path d="M1,14.38A3.48,3.48,0,1,0,1,9.45,3.49,3.49,0,0,0,1,14.38Z" />
      <path d="M15,14.38a3.48,3.48,0,1,1,0-4.93A3.49,3.49,0,0,1,15,14.38Z" />
    </SvgIcon>
  );
});

IconAsana.displayName = 'IconAsana';

export {IconAsana};
