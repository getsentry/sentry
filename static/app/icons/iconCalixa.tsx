import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconCalixa = React.forwardRef(function IconCalixa(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M12,12a5.59,5.59,0,0,1-3,.75A4.5,4.5,0,0,1,4.45,8a4.52,4.52,0,0,1,4.6-4.78,5.49,5.49,0,0,1,4.11,1.93l1.47-2.93A8,8,0,0,0,9.07,0a7.66,7.66,0,0,0-7.7,8A7.69,7.69,0,0,0,9,16a7.42,7.42,0,0,0,3.66-.82,5.36,5.36,0,0,0,1.43-1.09l-1.19-2.65S12.27,11.89,12,12Z" />
    </SvgIcon>
  );
});

IconCalixa.displayName = 'IconCalixa';

export {IconCalixa};
