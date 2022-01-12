import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconCheckmark = React.forwardRef<SVGSVGElement, SVGIconProps>(
  ({isCircled = false, ...props}, ref) => {
    return (
      <SvgIcon {...props} isCircled={isCircled} ref={ref} data-test-id="icon-check-mark">
        {isCircled ? (
          <path d="M7,12a.78.78,0,0,1-.57-.26L4,9.05A.76.76,0,0,1,4.07,8a.75.75,0,0,1,1.06.07l1.75,2L10.77,4.3A.75.75,0,0,1,12,5.14L7.58,11.7A.77.77,0,0,1,7,12Z" />
        ) : (
          <path d="M6.19,14.51a.77.77,0,0,1-.57-.25l-4.2-4.8a.75.75,0,0,1,1.13-1l3.56,4.06L13.36,1.82a.75.75,0,0,1,1-.21.76.76,0,0,1,.21,1.05L6.81,14.18a.73.73,0,0,1-.58.33Z" />
        )}
      </SvgIcon>
    );
  }
);

IconCheckmark.displayName = 'IconCheckmark';

export {IconCheckmark};
