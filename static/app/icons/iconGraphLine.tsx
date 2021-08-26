import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconGraphLine = React.forwardRef(function IconGraphLine(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.25,16H.75A.76.76,0,0,1,0,15.25V.75A.76.76,0,0,1,.75,0,.76.76,0,0,1,1.5.75V14.5H15.25a.75.75,0,0,1,0,1.5Z" />
      <path d="M.75,16a.8.8,0,0,1-.36-.09.75.75,0,0,1-.3-1L5.92,4.16a.78.78,0,0,1,1.32,0L9.71,8.72,14.6.38a.75.75,0,1,1,1.3.76l-5.57,9.48a.75.75,0,0,1-1.3,0L6.58,6.09,1.41,15.61A.75.75,0,0,1,.75,16Z" />
    </SvgIcon>
  );
});

IconGraphLine.displayName = 'IconGraphLine';

export {IconGraphLine};
