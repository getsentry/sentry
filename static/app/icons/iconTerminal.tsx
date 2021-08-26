import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconTerminal = React.forwardRef(function IconTerminal(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M.76,13.54a.74.74,0,0,1-.53-.22.75.75,0,0,1,0-1.06L4.75,7.74.23,3.22A.75.75,0,0,1,1.29,2.16L6.34,7.21a.75.75,0,0,1,0,1.06l-5,5.05A.74.74,0,0,1,.76,13.54Z" />
      <path d="M15.24,13.8H6.79a.75.75,0,1,1,0-1.5h8.45a.75.75,0,0,1,0,1.5Z" />
    </SvgIcon>
  );
});

IconTerminal.displayName = 'IconTerminal';

export {IconTerminal};
