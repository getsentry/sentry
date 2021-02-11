import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconEllipse = React.forwardRef(function IconEllipse(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <circle cx="8" cy="8" r="4" />
    </SvgIcon>
  );
});

IconEllipse.displayName = 'IconEllipse';

export {IconEllipse};
