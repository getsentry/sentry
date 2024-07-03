import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconTap = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M5.08,8.67V2.26c0-.81-.65-1.46-1.46-1.46s-1.46.65-1.46,1.46v6.31s0,0,0,0c0,3.66,1.46,6.63,5.84,6.63h0c4.39,0,5.84-2.97,5.84-6.63h0c0-.82-.65-1.48-1.46-1.48s-1.46.65-1.46,1.46v.11s0-1.58,0-1.58c0-.81-.65-1.46-1.46-1.46s-1.46.65-1.46,1.46v1.58s0-3.04,0-3.04c0-.81-.65-1.46-1.46-1.46s-1.46.65-1.46,1.46" />
    </SvgIcon>
  );
});

IconTap.displayName = 'IconTap';

export {IconTap};
