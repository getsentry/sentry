import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconChat = React.forwardRef(function IconChat(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M.94,16a.73.73,0,0,1-.47-.17A.74.74,0,0,1,.21,15l.93-3.92A6.83,6.83,0,0,1,0,7.35c0-4,3.59-7.3,8-7.3s8,3.28,8,7.3-3.59,7.29-8,7.29a8.59,8.59,0,0,1-3.11-.58L1.27,15.87A.8.8,0,0,1,.94,16Zm1.59-5.48a.74.74,0,0,1,.15.65L2,13.81l2.49-1.24a.73.73,0,0,1,.63,0A7,7,0,0,0,8,13.14c3.58,0,6.5-2.6,6.5-5.79S11.58,1.55,8,1.55s-6.5,2.6-6.5,5.8A5.32,5.32,0,0,0,2.53,10.47Z" />
    </SvgIcon>
  );
});

IconChat.displayName = 'IconChat';

export {IconChat};
