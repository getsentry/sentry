import {forwardRef, Fragment} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  locked?: boolean;
}

const IconLock = forwardRef<SVGSVGElement, Props>(({locked = false, ...props}, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      {locked ? (
        <Fragment>
          <path d="M11.67,7.94a.75.75,0,0,1-.75-.75V4.34a2.84,2.84,0,1,0-5.67,0V7.19a.75.75,0,1,1-1.5,0V4.34a4.34,4.34,0,1,1,8.67,0V7.19A.76.76,0,0,1,11.67,7.94" />
          <path d="M14.72,16H1.44a.76.76,0,0,1-.75-.75V7.19a.75.75,0,0,1,.75-.75H14.72a.75.75,0,0,1,.75.75v8.06A.76.76,0,0,1,14.72,16ZM2.19,14.5H14V7.94H2.19Z" />
          <path d="M8.08,12.94a.76.76,0,0,1-.75-.75V10.05a.75.75,0,0,1,1.5,0v2.14A.75.75,0,0,1,8.08,12.94Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M4.5,7.94a.75.75,0,0,1-.75-.75V4.34a4.34,4.34,0,0,1,8.5-1.21.76.76,0,0,1-.52.93.74.74,0,0,1-.92-.51,2.84,2.84,0,0,0-5.56.79V7.19A.76.76,0,0,1,4.5,7.94Z" />
          <path d="M14.72,16H1.44a.76.76,0,0,1-.75-.75V7.19a.75.75,0,0,1,.75-.75H14.72a.75.75,0,0,1,.75.75v8.06A.76.76,0,0,1,14.72,16ZM2.19,14.5H14V7.94H2.19Z" />
          <path d="M8.08,12.94a.76.76,0,0,1-.75-.75V10.05a.75.75,0,0,1,1.5,0v2.14A.75.75,0,0,1,8.08,12.94Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
});

IconLock.displayName = 'IconLock';

export {IconLock};
