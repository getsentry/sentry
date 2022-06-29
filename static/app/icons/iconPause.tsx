import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconPause = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M5.83,15.28H1.47a.76.76,0,0,1-.75-.75V1.47A.76.76,0,0,1,1.47.72H5.83a.76.76,0,0,1,.75.75V14.53A.76.76,0,0,1,5.83,15.28Zm-3.61-1.5H5.08V2.22H2.22Z" />
      <path d="M14.53,15.28H10.17a.76.76,0,0,1-.75-.75V1.47a.76.76,0,0,1,.75-.75h4.36a.76.76,0,0,1,.75.75V14.53A.76.76,0,0,1,14.53,15.28Zm-3.61-1.5h2.86V2.22H10.92Z" />
    </SvgIcon>
  );
});

IconPause.displayName = 'IconPause';

export {IconPause};
