import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon> & {
  isCircled?: boolean;
};

const IconCheckmark = React.forwardRef<SVGSVGElement, Props>(
  ({isCircled = false, ...props}: Props, ref) => (
    <SvgIcon {...props} ref={ref} data-test-id="icon-check-mark">
      {isCircled ? (
        <React.Fragment>
          <path d="M7,12a.78.78,0,0,1-.57-.26L4,9.05A.76.76,0,0,1,4.07,8a.75.75,0,0,1,1.06.07l1.75,2L10.77,4.3A.75.75,0,0,1,12,5.14L7.58,11.7A.77.77,0,0,1,7,12Z" />
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
        </React.Fragment>
      ) : (
        <path d="M5.81,15.71a.73.73,0,0,1-.56-.26L.18,9.67a.75.75,0,1,1,1.13-1l4.43,5.05L14.61.62a.75.75,0,1,1,1.24.84L6.43,15.38a.77.77,0,0,1-.57.33Z" />
      )}
    </SvgIcon>
  )
);

export {IconCheckmark};
