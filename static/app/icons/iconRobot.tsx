import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconRobot = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path
        d="M8 5.09091V2.18182H5.09091"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.45455"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.3636 5.09091H3.63636C2.83304 5.09091 2.18182 5.74213 2.18182 6.54545V12.3636C2.18182 13.167 2.83304 13.8182 3.63636 13.8182H12.3636C13.167 13.8182 13.8182 13.167 13.8182 12.3636V6.54545C13.8182 5.74213 13.167 5.09091 12.3636 5.09091Z"
        stroke="currentColor"
        strokeWidth="1.45455"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.727273 9.45455H2.18182"
        stroke="currentColor"
        strokeWidth="1.45455"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.8182 9.45455H15.2727"
        stroke="currentColor"
        strokeWidth="1.45455"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.1818 8.72727V10.1818"
        stroke="currentColor"
        strokeWidth="1.45455"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.81818 8.72727V10.1818"
        stroke="currentColor"
        strokeWidth="1.45455"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
});

IconRobot.displayName = 'IconRobot';

export {IconRobot};
