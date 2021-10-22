import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconRectangle = React.forwardRef(function IconRectangle(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
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
