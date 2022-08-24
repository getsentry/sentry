import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconNumber = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.24,5.36H.76a.75.75,0,0,1,0-1.5H15.24a.75.75,0,0,1,0,1.5Z" />
      <path d="M15.24,12.14H.76a.75.75,0,0,1,0-1.5H15.24a.75.75,0,1,1,0,1.5Z" />
      <path d="M4.61,16a.75.75,0,0,1-.75-.75V.76a.75.75,0,0,1,1.5,0V15.24A.76.76,0,0,1,4.61,16Z" />
      <path d="M11.39,16a.76.76,0,0,1-.75-.75V.76a.75.75,0,1,1,1.5,0V15.24A.75.75,0,0,1,11.39,16Z" />
    </SvgIcon>
  );
});

IconNumber.displayName = 'IconNumber';

export {IconNumber};
