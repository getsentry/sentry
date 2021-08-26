import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconMute = React.forwardRef(function IconMute(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M9.17,14H6.57a.77.77,0,0,1-.42-.13L3.08,11.78H.86A.74.74,0,0,1,.11,11V5a.74.74,0,0,1,.75-.75H3.08L6.15,2.15A.77.77,0,0,1,6.57,2h2.6a.76.76,0,0,1,.75.75V13.23A.76.76,0,0,1,9.17,14ZM6.8,12.48H8.42v-9H6.8L3.73,5.59a.77.77,0,0,1-.42.13H1.61v4.56h1.7a.77.77,0,0,1,.42.13Z" />
      <path d="M12.22,8,10.83,6.61a.75.75,0,1,1,1.06-1.06l1.39,1.39,1.39-1.39a.75.75,0,0,1,1.06,1.06L14.34,8l1.39,1.39a.75.75,0,0,1,0,1.06.74.74,0,0,1-.53.22.71.71,0,0,1-.53-.22L13.28,9.06l-1.39,1.39a.75.75,0,0,1-1.06,0,.75.75,0,0,1,0-1.06Z" />
    </SvgIcon>
  );
});

IconMute.displayName = 'IconMute';

export {IconMute};
