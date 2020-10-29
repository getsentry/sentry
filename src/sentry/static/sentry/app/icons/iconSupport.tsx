import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconSupport = React.forwardRef(function IconSupport(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M9.9,15.61H6.1a.74.74,0,0,1-.75-.75v-2.6a.74.74,0,0,1,.75-.75H9.9a.74.74,0,0,1,.75.75v2.6A.74.74,0,0,1,9.9,15.61Zm-3.05-1.5h2.3V13H6.85Z" />
      <path d="M6.1,14.31H5.37a2.75,2.75,0,0,1-2.75-2.75V3.14A2.75,2.75,0,0,1,5.37.39h5.26a2.75,2.75,0,0,1,2.75,2.75V9.4h-1.5V3.14a1.25,1.25,0,0,0-1.25-1.25H5.37A1.25,1.25,0,0,0,4.12,3.14v8.42a1.25,1.25,0,0,0,1.25,1.25H6.1Z" />
      <path d="M3.37,10.16H2.2A2.25,2.25,0,0,1,0,7.91V7A2.25,2.25,0,0,1,2.2,4.74H3.37v1.5H2.2A.74.74,0,0,0,1.45,7v.92a.75.75,0,0,0,.75.75H3.37Z" />
      <path d="M13.8,10.16H12.63V8.66H13.8a.75.75,0,0,0,.75-.75V7a.74.74,0,0,0-.75-.75H12.63V4.74H13.8A2.25,2.25,0,0,1,16.05,7v.92A2.25,2.25,0,0,1,13.8,10.16Z" />
    </SvgIcon>
  );
});

IconSupport.displayName = 'IconSupport';

export {IconSupport};
