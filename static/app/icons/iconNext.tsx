import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconNext = React.forwardRef(function IconNext(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M.75,15.48a.69.69,0,0,1-.37-.1A.73.73,0,0,1,0,14.73V1.27A.73.73,0,0,1,.38.62a.75.75,0,0,1,.74,0L12.78,7.35a.75.75,0,0,1,0,1.3L1.12,15.38A.69.69,0,0,1,.75,15.48ZM1.5,2.57V13.43L10.91,8Z" />
      <path d="M15.25,15.94a.76.76,0,0,1-.75-.75V.81a.75.75,0,1,1,1.5,0V15.19A.76.76,0,0,1,15.25,15.94Z" />
    </SvgIcon>
  );
});

IconNext.displayName = 'IconNext';

export {IconNext};
