import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconGlobe = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,15.98C3.6,15.98.02,12.4.02,8S3.6.02,8,.02s7.98,3.58,7.98,7.98-3.58,7.98-7.98,7.98ZM8,1.52c-3.57,0-6.48,2.91-6.48,6.48s2.91,6.48,6.48,6.48,6.48-2.91,6.48-6.48S11.57,1.52,8,1.52Z" />
      <path d="M8,15.98c-2.34,0-3.56-4.02-3.56-7.98S5.66.02,8,.02s3.56,4.02,3.56,7.98-1.22,7.98-3.56,7.98ZM8,1.52c-.82,0-2.06,2.59-2.06,6.48s1.24,6.48,2.06,6.48,2.06-2.59,2.06-6.48-1.24-6.48-2.06-6.48Z" />
      <rect x="1.07" y="5.21" width="13.87" height="1.5" />
      <rect x="1.06" y="9.29" width="13.87" height="1.5" />
    </SvgIcon>
  );
});

IconGlobe.displayName = 'IconGlobe';

export {IconGlobe};
