import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconGraphArea = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M.75,16.09A.76.76,0,0,1,0,15.34V.84a.75.75,0,0,1,1.5,0v14.5A.76.76,0,0,1,.75,16.09Z" />
      <path d="M15.25,16.09H.75a.74.74,0,0,1-.64-.37.73.73,0,0,1,0-.74L5.92,4.25a.78.78,0,0,1,1.32,0L9.71,8.8,14.6.47a.75.75,0,0,1,.85-.35A.76.76,0,0,1,16,.85V15.34A.76.76,0,0,1,15.25,16.09ZM2,14.59H14.5v-11l-4.17,7.1a.74.74,0,0,1-.64.37h0A.77.77,0,0,1,9,10.69L6.58,6.17Z" />
    </SvgIcon>
  );
});

IconGraphArea.displayName = 'IconGraphArea';

export {IconGraphArea};
