import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconRectangle = React.forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <rect
        x="6.38721"
        y="0.341797"
        width="9.03286"
        height="9.03286"
        rx="1.5"
        transform="rotate(45 6.38721 0.341797)"
      />
    </SvgIcon>
  );
});

IconRectangle.displayName = 'IconRectangle';

export {IconRectangle};
