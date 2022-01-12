import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconSubtract = React.forwardRef<SVGSVGElement, SVGIconProps>(
  ({isCircled = false, ...props}, ref) => {
    return (
      <SvgIcon {...props} isCircled={isCircled} data-test-id="icon-subtract" ref={ref}>
        {isCircled ? (
          <path d="M11.28,8.75H4.72a.75.75,0,1,1,0-1.5h6.56a.75.75,0,1,1,0,1.5Z" />
        ) : (
          <path d="M14,8.75H2a.75.75,0,0,1,0-1.5H14a.75.75,0,0,1,0,1.5Z" />
        )}
      </SvgIcon>
    );
  }
);

IconSubtract.displayName = 'IconSubtract';

export {IconSubtract};
