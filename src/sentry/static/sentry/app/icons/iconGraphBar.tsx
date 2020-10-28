import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconGraphBar = React.forwardRef(function IconGraphBar(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M4.06,16H.74A.75.75,0,0,1,0,15.24v-4a.74.74,0,0,1,.75-.75H4.06a.75.75,0,0,1,.75.75v4A.76.76,0,0,1,4.06,16Zm-2.57-1.5H3.31V12H1.49Z" />
      <path d="M9.65,16H6.33a.76.76,0,0,1-.75-.75V6.06a.75.75,0,0,1,.75-.75H9.65a.74.74,0,0,1,.75.75v9.18A.75.75,0,0,1,9.65,16Zm-2.57-1.5H8.9V6.81H7.08Z" />
      <path d="M15.25,16H11.93a.75.75,0,0,1-.75-.75V.76A.75.75,0,0,1,11.93,0h3.32A.76.76,0,0,1,16,.76V15.24A.76.76,0,0,1,15.25,16Zm-2.57-1.5H14.5v-13H12.68Z" />
    </SvgIcon>
  );
});

IconGraphBar.displayName = 'IconGraphBar';

export {IconGraphBar};
