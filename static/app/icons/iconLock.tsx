import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconLock = React.forwardRef(function IconLock(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M12.42,7.19h-1.5V4.34a2.84,2.84,0,1,0-5.67,0V7.19H3.75V4.34a4.34,4.34,0,1,1,8.67,0Z" />
      <path d="M14.72,16H1.44a.76.76,0,0,1-.75-.75V7.19a.75.75,0,0,1,.75-.75H14.72a.75.75,0,0,1,.75.75v8.06A.76.76,0,0,1,14.72,16ZM2.19,14.5H14V7.94H2.19Z" />
      <path d="M8.08,12.94a.76.76,0,0,1-.75-.75V10.05a.75.75,0,0,1,1.5,0v2.14A.75.75,0,0,1,8.08,12.94Z" />
    </SvgIcon>
  );
});

IconLock.displayName = 'IconLock';

export {IconLock};
