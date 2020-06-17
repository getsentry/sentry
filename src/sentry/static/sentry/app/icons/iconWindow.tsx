import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconWindow = React.forwardRef(function IconWindow(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
      <rect x="0.75" y="4.62" width="14.5" height="1.5" />
      <circle cx="3.17" cy="3.18" r="0.76" />
      <circle cx="5.47" cy="3.18" r="0.76" />
      <circle cx="7.76" cy="3.18" r="0.76" />
    </SvgIcon>
  );
});

IconWindow.displayName = 'IconWindow';

export {IconWindow};
