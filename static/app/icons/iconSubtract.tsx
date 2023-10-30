import {forwardRef, Fragment} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

interface Props extends SVGIconProps {
  isCircled?: boolean;
}

const IconSubtract = forwardRef<SVGSVGElement, Props>(
  ({isCircled = false, ...props}, ref) => {
    return (
      <SvgIcon {...props} data-test-id="icon-subtract" ref={ref}>
        {isCircled ? (
          <Fragment>
            <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
            <path d="M11.28,8.75H4.72a.75.75,0,1,1,0-1.5h6.56a.75.75,0,1,1,0,1.5Z" />
          </Fragment>
        ) : (
          <path d="M14,8.75H2a.75.75,0,0,1,0-1.5H14a.75.75,0,0,1,0,1.5Z" />
        )}
      </SvgIcon>
    );
  }
);

IconSubtract.displayName = 'IconSubtract';

export {IconSubtract};
