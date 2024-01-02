import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconCursorArrow = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path
        d="M15.28,14.22l-5.01-5.01l4.56-2.29c0.27-0.13,0.43-0.41,0.42-0.71c-0.02-0.3-0.21-0.56-0.49-0.66l-13.25-5
		C1.24,0.44,0.93,0.51,0.72,0.72C0.51,0.93,0.44,1.24,0.55,1.51l5,13.25c0.1,0.28,0.36,0.47,0.66,0.49h0.04
		c0.28,0,0.54-0.16,0.67-0.42l2.29-4.56l5.01,5.01c0.15,0.15,0.34,0.22,0.53,0.22s0.38-0.07,0.53-0.22
		C15.57,14.99,15.57,14.51,15.28,14.22z M6.35,12.63L2.54,2.54l10.09,3.81L8.72,8.3C8.69,8.32,8.67,8.33,8.65,8.34
		C8.58,8.37,8.52,8.42,8.47,8.47c-0.05,0.05-0.1,0.11-0.13,0.18C8.33,8.67,8.32,8.69,8.3,8.72L6.35,12.63z"
      />
    </SvgIcon>
  );
});

IconCursorArrow.displayName = 'IconCursorArrow';

export {IconCursorArrow};
