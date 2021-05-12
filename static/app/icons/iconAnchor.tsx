import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconAnchor = React.forwardRef(function IconAnchor(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,1.59a.31.31,0,1,0,.31.31A.31.31,0,0,0,8,1.59ZM6.19,1.9A1.81,1.81,0,1,1,8.75,3.55v2h4.66a.75.75,0,0,1,0,1.5H8.75v7.32a6.87,6.87,0,0,0,5.57-4.12.75.75,0,0,1,1.44.3v2.5a.75.75,0,0,1-1.5,0,8.38,8.38,0,0,1-12.52,0,.75.75,0,0,1-1.5,0v-2.5a.75.75,0,0,1,1.44-.3,6.87,6.87,0,0,0,5.57,4.12V7.05H2.59a.75.75,0,1,1,0-1.5H7.25v-2A1.81,1.81,0,0,1,6.19,1.9Z" />
    </SvgIcon>
  );
});

IconAnchor.displayName = 'IconAnchor';

export {IconAnchor};
