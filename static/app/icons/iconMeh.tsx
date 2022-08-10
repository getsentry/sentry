import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconMeh = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
      <circle cx="4.84" cy="6.79" r="0.99" />
      <circle cx="11.32" cy="6.79" r="0.99" />
      <path d="M12.32,10.78H3.85a.75.75,0,1,1,0-1.5h8.47a.75.75,0,0,1,0,1.5Z" />
    </SvgIcon>
  );
});

IconMeh.displayName = 'IconMeh';

export {IconMeh};
