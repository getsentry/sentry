import * as React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconKomodor = React.forwardRef(function IconKomodor(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M14.58,13.74H1.42L0,12.32V3.88L1.62,2.26H14.38L16,3.88v8.44ZM2.07,12.18H13.93l.51-.51V4.53l-.71-.71H2.27l-.71.71v7.14Z" />
      <ellipse cx="5.99" cy="7.42" rx="1.36" ry="2.07" />
      <ellipse cx="10" cy="7.42" rx="1.36" ry="2.07" />
    </SvgIcon>
  );
});

IconKomodor.displayName = 'IconKomodor';

export {IconKomodor};
