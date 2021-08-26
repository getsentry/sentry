import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconPrevious = React.forwardRef(function IconPrevious(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.25,15.48a.69.69,0,0,1-.37-.1L3.22,8.65a.75.75,0,0,1,0-1.3L14.88.62a.75.75,0,0,1,.74,0,.73.73,0,0,1,.38.65V14.73a.73.73,0,0,1-.38.65A.69.69,0,0,1,15.25,15.48ZM5.09,8l9.41,5.43V2.57Z" />
      <path d="M.75,15.94A.76.76,0,0,1,0,15.19V.81A.76.76,0,0,1,.75.06.76.76,0,0,1,1.5.81V15.19A.76.76,0,0,1,.75,15.94Z" />
    </SvgIcon>
  );
});

IconPrevious.displayName = 'IconPrevious';

export {IconPrevious};
