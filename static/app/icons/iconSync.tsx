import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconSync = React.forwardRef(function IconSync(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M14.42,15.9a.75.75,0,0,1-.75-.75V11.89H10.41a.75.75,0,0,1,0-1.5h4a.75.75,0,0,1,.75.75v4A.76.76,0,0,1,14.42,15.9Z" />
      <path d="M8,15.9A7.91,7.91,0,0,1,.11,8a.76.76,0,0,1,.75-.75A.76.76,0,0,1,1.61,8a6.39,6.39,0,0,0,12.14,2.81.75.75,0,0,1,1.35.66A7.86,7.86,0,0,1,8,15.9Z" />
      <path d="M5.61,5.61h-4a.75.75,0,0,1-.75-.75v-4a.75.75,0,0,1,1.5,0V4.11H5.61a.75.75,0,0,1,0,1.5Z" />
      <path d="M15.15,8.75A.76.76,0,0,1,14.4,8,6.39,6.39,0,0,0,2.26,5.19.75.75,0,0,1,.91,4.53,7.9,7.9,0,0,1,15.9,8,.75.75,0,0,1,15.15,8.75Z" />
    </SvgIcon>
  );
});

IconSync.displayName = 'IconSync';

export {IconSync};
