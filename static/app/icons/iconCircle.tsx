import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconCircle = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
    </SvgIcon>
  );
});

IconCircle.displayName = 'IconCircle';

export {IconCircle};
