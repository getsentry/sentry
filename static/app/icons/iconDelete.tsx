import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconDelete = React.forwardRef<SVGSVGElement, Props>(function IconDelete(
  props,
  ref
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M14.71,3.94H1.29a.75.75,0,0,1,0-1.5H14.71a.75.75,0,0,1,0,1.5Z" />
      <path d="M12.69,15.94H3.31a1.75,1.75,0,0,1-1.75-1.75v-11h1.5v11a.25.25,0,0,0,.25.25h9.38a.25.25,0,0,0,.25-.25v-11h1.5v11A1.75,1.75,0,0,1,12.69,15.94Z" />
      <path d="M5,13a.74.74,0,0,1-.75-.75V6.14a.75.75,0,0,1,1.5,0v6.1A.75.75,0,0,1,5,13Z" />
      <path d="M8,13a.75.75,0,0,1-.75-.75V6.14a.75.75,0,0,1,1.5,0v6.1A.75.75,0,0,1,8,13Z" />
      <path d="M11.05,13a.75.75,0,0,1-.75-.75V6.14a.75.75,0,0,1,1.5,0v6.1A.74.74,0,0,1,11.05,13Z" />
      <path d="M10.51,3.47l-.81-2H6.3l-.81,2L4.1,2.91,5,.77A1.26,1.26,0,0,1,6.13,0H9.87A1.26,1.26,0,0,1,11,.77l.87,2.14Z" />
    </SvgIcon>
  );
});

export {IconDelete};
