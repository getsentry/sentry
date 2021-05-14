import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconList = React.forwardRef(function IconList(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.19,8.75H3.7a.75.75,0,1,1,0-1.5H15.19a.75.75,0,0,1,0,1.5Z" />
      <circle cx="0.75" cy="8" r="0.75" />
      <path d="M15.19,15H3.7a.75.75,0,1,1,0-1.5H15.19a.75.75,0,1,1,0,1.5Z" />
      <circle cx="0.75" cy="14.25" r="0.75" />
      <path d="M15.19,2.53H3.7A.75.75,0,0,1,3.7,1H15.19a.75.75,0,1,1,0,1.5Z" />
      <circle cx="0.75" cy="1.75" r="0.75" />
    </SvgIcon>
  );
});

IconList.displayName = 'IconList';

export {IconList};
