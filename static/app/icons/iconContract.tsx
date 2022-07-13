import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconContract = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M5.02,16c-.41,0-.75-.34-.75-.75v-3.49H.78c-.41,0-.75-.34-.75-.75s.34-.75,.75-.75H5.02c.41,0,.75,.34,.75,.75v4.24c0,.41-.34,.75-.75,.75Z" />
      <path d="M11.05,16c-.41,0-.75-.34-.75-.75v-4.24c0-.41,.34-.75,.75-.75h4.22c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75h-3.47v3.49c0,.41-.34,.75-.75,.75Z" />
      <path d="M5.01,5.73H.79c-.41,0-.75-.34-.75-.75s.34-.75,.75-.75h3.47V.76C4.26,.35,4.6,0,5.01,0s.75,.34,.75,.75V4.98c0,.41-.34,.75-.75,.75Z" />
      <path d="M15.27,5.73h-4.22c-.41,0-.75-.34-.75-.75V.76c0-.41,.34-.75,.75-.75s.75,.34,.75,.75v3.47h3.47c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75Z" />
    </SvgIcon>
  );
});

IconContract.displayName = 'IconContract';

export {IconContract};
