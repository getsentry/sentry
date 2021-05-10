import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconRookout = React.forwardRef(function IconRookout(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M9.82,0a2.37,2.37,0,0,1-.45.58A1.85,1.85,0,0,1,8,.89H8A2.85,2.85,0,0,0,5.14,3.74V5l-.06.06a3.06,3.06,0,0,0-1,2.4,5.93,5.93,0,0,0,1,3H3.26a1.09,1.09,0,0,1-1.09-.79h-1v.13c0,1.22,1,1.77,2.06,1.77H5.5L5,13.32a1.81,1.81,0,0,0,.09,1.35,1.16,1.16,0,0,0,.78.62,1.22,1.22,0,0,0,.73-.06l.15-.05.07.13.11.16a1.33,1.33,0,0,0,2.12,0l.1-.16.08-.13.14.05a1.15,1.15,0,0,0,.71.06,1.24,1.24,0,0,0,.79-.62A1.8,1.8,0,0,0,11,13.32l-.47-1.73h2.27c1.08,0,2.06-.55,2.06-1.77V9.71h-1a1.08,1.08,0,0,1-1.09.79H10.93a5.93,5.93,0,0,0,1-3,3,3,0,0,0-1-2.4l0,0,1.38-.9a4.36,4.36,0,0,0-1.67-1.71A2.2,2.2,0,0,0,10.31,2l-.07-.07,0-.09A2.49,2.49,0,0,0,9.82,0" />
    </SvgIcon>
  );
});

IconRookout.displayName = 'IconRookout';

export {IconRookout};
