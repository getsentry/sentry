import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconEllipsis = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <circle cx="8" cy="8" r="1.31" />
      <circle cx="1.31" cy="8" r="1.31" />
      <circle cx="14.69" cy="8" r="1.31" />
    </SvgIcon>
  );
});

IconEllipsis.displayName = 'IconEllipsis';

export {IconEllipsis};
