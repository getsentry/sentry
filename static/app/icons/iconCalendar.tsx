import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconCalendar = React.forwardRef(function IconCalendar(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V4.18A2.75,2.75,0,0,1,2.75,1.43h10.5A2.75,2.75,0,0,1,16,4.18v9.07A2.75,2.75,0,0,1,13.25,16ZM2.75,2.93A1.25,1.25,0,0,0,1.5,4.18v9.07A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V4.18a1.25,1.25,0,0,0-1.25-1.25Z" />
      <path d="M4.36,4.43a.76.76,0,0,1-.75-.75V.77a.75.75,0,0,1,1.5,0V3.68A.75.75,0,0,1,4.36,4.43Z" />
      <path d="M11.64,4.43a.75.75,0,0,1-.75-.75V.77a.75.75,0,1,1,1.5,0V3.68A.76.76,0,0,1,11.64,4.43Z" />
      <rect x="0.75" y="5.8" width="14.5" height="1.5" />
    </SvgIcon>
  );
});

IconCalendar.displayName = 'IconCalendar';

export {IconCalendar};
