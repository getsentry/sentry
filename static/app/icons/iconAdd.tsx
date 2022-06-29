import {forwardRef, Fragment} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

interface Props extends SVGIconProps {
  isCircled?: boolean;
}

const IconAdd = forwardRef<SVGSVGElement, Props>(({isCircled = false, ...props}, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      {isCircled ? (
        <Fragment>
          <path d="M11.28,8.75H4.72a.75.75,0,1,1,0-1.5h6.56a.75.75,0,1,1,0,1.5Z" />
          <path d="M8,12a.76.76,0,0,1-.75-.75V4.72a.75.75,0,0,1,1.5,0v6.56A.76.76,0,0,1,8,12Z" />
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8.75,7.25V2a.75.75,0,0,0-1.5,0V7.25H2a.75.75,0,0,0,0,1.5H7.25V14a.75.75,0,0,0,1.5,0V8.75H14a.75.75,0,0,0,0-1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
});

IconAdd.displayName = 'IconAdd';

export {IconAdd};
