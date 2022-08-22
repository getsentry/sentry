import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconSad = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
      <circle cx="4.84" cy="6.79" r="0.99" />
      <circle cx="11.32" cy="6.79" r="0.99" />
      <path d="M4.44,12.27a.72.72,0,0,1-.4-.12.76.76,0,0,1-.23-1A5,5,0,0,1,12.18,11a.75.75,0,1,1-1.24.84,3.5,3.5,0,0,0-5.87.08A.75.75,0,0,1,4.44,12.27Z" />
    </SvgIcon>
  );
});

IconSad.displayName = 'IconSad';

export {IconSad};
