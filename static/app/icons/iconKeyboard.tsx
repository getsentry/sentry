import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconKeyboard = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.28,13.49H.72c-.41,0-.75-.34-.75-.75V3.26c0-.41.34-.75.75-.75h14.56c.41,0,.75.34.75.75v9.49c0,.41-.34.75-.75.75ZM1.47,11.99h13.06v-7.99H1.47v7.99Z" />
      <rect x="10.89" y="3.26" width="1.5" height="6.32" />
      <rect x="3.61" y="3.26" width="1.5" height="6.32" />
      <rect x="7.25" y="3.26" width="1.5" height="6.32" />
      <rect x=".72" y="8.83" width="14.56" height="1.5" />
      <rect x=".72" y="5.67" width="14.56" height="1.5" />
    </SvgIcon>
  );
});

IconKeyboard.displayName = 'IconKeyboard';

export {IconKeyboard};
