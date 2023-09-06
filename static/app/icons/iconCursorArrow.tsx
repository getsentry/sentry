import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconCursorArrow = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path
        d="M10.34,9.28l5.19-2.08C15.81,7.08,16,6.81,16,6.5s-0.19-0.58-0.47-0.7L1.03,0.05c-0.28-0.11-0.6-0.04-0.81,0.17
		C0.01,0.43-0.06,0.75,0.05,1.03l5.75,14.5C5.92,15.81,6.19,16,6.5,16s0.58-0.19,0.7-0.47l2.08-5.19l5.44,5.44
		c0.15,0.15,0.34,0.22,0.53,0.22c0.19,0,0.38-0.07,0.53-0.22c0.29-0.29,0.29-0.77,0-1.06L10.34,9.28z M6.5,13.22L2.09,2.09
		L13.22,6.5l-4.5,1.8C8.63,8.34,8.54,8.4,8.47,8.47C8.4,8.54,8.34,8.63,8.3,8.72L6.5,13.22z"
      />
    </SvgIcon>
  );
});

IconCursorArrow.displayName = 'IconCursorArrow';

export {IconCursorArrow};
