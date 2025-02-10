import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconDivide = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M14,8.75H2c-.41,0-.75-.34-.75-.75s.34-.75.75-.75h12c.41,0,.75.34.75.75s-.34.75-.75.75Z" />
      <circle cx="7.95" cy="2.42" r="1.31" />
      <circle cx="7.95" cy="13.56" r="1.31" />
    </SvgIcon>
  );
});

IconDivide.displayName = 'IconDivide';

export {IconDivide};
