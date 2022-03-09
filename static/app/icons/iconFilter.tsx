import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconFilter = React.forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.1 3.7H.8C.3 3.7 0 3.4 0 3c0-.4.3-.8.8-.8h14.4c.4 0 .8.3.8.8s-.5.7-.9.7Z" />
      <path d="M11.6 13.8H4.3c-.4 0-.8-.3-.8-.8s.3-.8.8-.8h7.3c.4 0 .8.3.8.8s-.4.8-.8.8Z" />
      <path d="M13.4 8.7H2.5c-.4 0-.7-.3-.7-.7 0-.4.3-.8.8-.8h10.8c.4 0 .8.3.8.8-.1.4-.4.7-.8.7Z" />
    </SvgIcon>
  );
});

IconFilter.displayName = 'IconFilter';

export {IconFilter};
