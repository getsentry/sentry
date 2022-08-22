import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconOption = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.21,14.16h-4.55c-.28,0-.54-.16-.67-.41L4.68,3.51H.71C.3,3.51-.04,3.17-.04,2.76s.34-.75,.75-.75H5.14c.28,0,.54,.16,.67,.41l5.31,10.25h4.1c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75Z" />
      <path d="M15.21,3.51h-5.25c-.41,0-.75-.34-.75-.75s.34-.75,.75-.75h5.25c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75Z" />
    </SvgIcon>
  );
});

IconOption.displayName = 'IconOption';

export {IconOption};
