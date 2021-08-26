import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconAsana = React.forwardRef(function IconAsana(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M8,.61A3.48,3.48,0,1,1,4.52,4.09,3.48,3.48,0,0,1,8,.61Z" />
      <path d="M1,14.38A3.48,3.48,0,1,0,1,9.45,3.49,3.49,0,0,0,1,14.38Z" />
      <path d="M15,14.38a3.48,3.48,0,1,1,0-4.93A3.49,3.49,0,0,1,15,14.38Z" />
    </SvgIcon>
  );
});

IconAsana.displayName = 'IconAsana';

export {IconAsana};
