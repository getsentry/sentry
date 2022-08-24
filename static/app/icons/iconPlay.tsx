import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconPlay = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M2.17,15.48a.69.69,0,0,1-.37-.1.73.73,0,0,1-.38-.65V1.27A.73.73,0,0,1,1.8.62a.77.77,0,0,1,.75,0L14.2,7.35a.75.75,0,0,1,0,1.3L2.55,15.38A.75.75,0,0,1,2.17,15.48ZM2.92,2.57V13.43L12.33,8Z" />
    </SvgIcon>
  );
});

IconPlay.displayName = 'IconPlay';

export {IconPlay};
