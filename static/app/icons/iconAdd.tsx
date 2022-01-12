import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconAdd = React.forwardRef<SVGSVGElement, SVGIconProps>(
  ({isCircled = false, ...props}, ref) => {
    return (
      <SvgIcon {...props} isCircled={isCircled} ref={ref}>
        {isCircled ? (
          <React.Fragment>
            <path d="M11.28,8.75H4.72a.75.75,0,1,1,0-1.5h6.56a.75.75,0,1,1,0,1.5Z" />
            <path d="M8,12a.76.76,0,0,1-.75-.75V4.72a.75.75,0,0,1,1.5,0v6.56A.76.76,0,0,1,8,12Z" />
          </React.Fragment>
        ) : (
          <path d="M8.75,7.25V2a.75.75,0,0,0-1.5,0V7.25H2a.75.75,0,0,0,0,1.5H7.25V14a.75.75,0,0,0,1.5,0V8.75H14a.75.75,0,0,0,0-1.5Z" />
        )}
      </SvgIcon>
    );
  }
);

IconAdd.displayName = 'IconAdd';

export {IconAdd};
