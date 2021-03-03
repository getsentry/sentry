import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconNot = React.forwardRef(function IconNot(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,0a8,8,0,1,0,8,8A8,8,0,0,0,8,0ZM1.53,8A6.47,6.47,0,0,1,8,1.53a6.4,6.4,0,0,1,4,1.4L2.93,12A6.4,6.4,0,0,1,1.53,8ZM8,14.47a6.38,6.38,0,0,1-4-1.4L13.07,4a6.38,6.38,0,0,1,1.4,4A6.47,6.47,0,0,1,8,14.47Z" />
    </SvgIcon>
  );
});

IconNot.displayName = 'IconNot';

export {IconNot};
