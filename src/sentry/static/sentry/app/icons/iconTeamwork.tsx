import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconTeamwork = React.forwardRef(function IconTeamwork(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M5.86,6A1.28,1.28,0,0,0,7.31,4.66,1.32,1.32,0,0,0,5.89,3.3H3.8V1.77A1.59,1.59,0,0,0,2.2.09,1.58,1.58,0,0,0,.6,1.77V12.33c0,2.53,1,3.66,3.32,3.66a4.56,4.56,0,0,0,2.49-.62A1.18,1.18,0,0,0,7,14.31c0-.68-.46-1.43-1.12-1.43a.72.72,0,0,0-.28,0L5.44,13a1.83,1.83,0,0,1-.76.18c-.41,0-.88-.14-.88-1.26V6Z" />
      <path d="M12.6,10.47a2.77,2.77,0,1,0,2.8,2.77,2.78,2.78,0,0,0-2.8-2.77" />
    </SvgIcon>
  );
});

IconTeamwork.displayName = 'IconTeamwork';

export {IconTeamwork};
