import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconExpand = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M15.26,5.74c-.41,0-.75-.34-.75-.75V1.5h-3.49c-.41,0-.75-.34-.75-.75s.34-.75,.75-.75h4.24c.41,0,.75,.34,.75,.75V4.99c0,.41-.34,.75-.75,.75Z" />
      <path d="M.78,5.74C.36,5.74,.03,5.4,.03,4.99V.75C.03,.34,.36,0,.78,0H4.99c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75H1.53v3.49c0,.41-.34,.75-.75,.75Z" />
      <path d="M15.23,16h-4.22c-.41,0-.75-.34-.75-.75s.34-.75,.75-.75h3.47v-3.47c0-.41,.34-.75,.75-.75s.75,.34,.75,.75v4.22c0,.41-.34,.75-.75,.75Z" />
      <path d="M4.97,16H.76C.34,16,0,15.66,0,15.25v-4.22c0-.41,.34-.75,.75-.75s.75,.34,.75,.75v3.47h3.47c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75Z" />
    </SvgIcon>
  );
});

IconExpand.displayName = 'IconExpand';

export {IconExpand};
