import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconGlobe = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.52A6.48,6.48,0,1,0,14.48,8,6.49,6.49,0,0,0,8,1.52Z" />
      <path d="M8,16c-2.34,0-3.56-4-3.56-8S5.66,0,8,0s3.56,4,3.56,8S10.33,16,8,16ZM8,1.52C7.18,1.52,5.94,4.1,5.94,8S7.18,14.48,8,14.48,10.06,11.9,10.06,8,8.82,1.52,8,1.52Z" />
      <rect x="1.07" y="5.21" width="13.87" height="1.5" />
      <rect x="1.06" y="9.29" width="13.87" height="1.5" />
    </SvgIcon>
  );
});

IconGlobe.displayName = 'IconGlobe';

export {IconGlobe};
