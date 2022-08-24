import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconResize = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M1.5,2.61l12,11.9H8A.75.75,0,0,0,8,16h7.25a.75.75,0,0,0,.75-.75V8a.75.75,0,0,0-1.5,0v5.43L2.57,1.55H8A.75.75,0,0,0,8,.05H.75A.76.76,0,0,0,0,.8V8a.75.75,0,0,0,.75.75A.74.74,0,0,0,1.5,8Z" />
    </SvgIcon>
  );
});

IconResize.displayName = 'IconResize';

export {IconResize};
