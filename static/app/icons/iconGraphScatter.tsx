import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconGraphScatter = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <circle cx="1.31" cy="14.69" r="1.31" />
      <circle cx="14.69" cy="1.31" r="1.31" />
      <circle cx="7.86" cy="9.25" r="1.31" />
      <circle cx="8.75" cy="3.56" r="1.31" />
      <circle cx="1.85" cy="10.12" r="1.31" />
      <circle cx="8.14" cy="12.37" r="1.31" />
      <circle cx="12.61" cy="5.52" r="1.31" />
      <circle cx="4.92" cy="8.68" r="1.31" />
      <circle cx="12.11" cy="12.18" r="1.31" />
      <circle cx="12.11" cy="8.12" r="1.31" />
    </SvgIcon>
  );
});

IconGraphScatter.displayName = 'IconGraphScatter';

export {IconGraphScatter};
