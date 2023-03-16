import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconCircleFill = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
    </SvgIcon>
  );
});

IconCircleFill.displayName = 'IconCircleFill';

export {IconCircleFill};
