import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconFilter = React.forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.19,2.53H.81A.75.75,0,0,1,.81,1H15.19a.75.75,0,1,1,0,1.5Z" />
      <path d="M11.63,15H4.36a.75.75,0,0,1,0-1.5h7.27a.75.75,0,0,1,0,1.5Z" />
      <path d="M13.41,8.75H2.58a.75.75,0,0,1,0-1.5H13.41a.75.75,0,0,1,0,1.5Z" />
    </SvgIcon>
  );
});

IconFilter.displayName = 'IconFilter';

export {IconFilter};
