import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconRefresh = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="m9.66,4.87c0,.41.34.75.75.75h4.01c.41,0,.75-.34.75-.75V.85c0-.41-.34-.75-.75-.75s-.75.34-.75.75v3.26h-3.26c-.41,0-.75.34-.75.75Z" />
      <path d="m.11,8c0,4.35,3.54,7.9,7.9,7.9s7.9-3.54,7.9-7.9c0-.41-.34-.75-.75-.75s-.75.34-.75.75c0,3.53-2.87,6.4-6.4,6.4S1.61,11.53,1.61,8,4.48,1.6,8.01,1.6c2.46,0,4.66,1.37,5.75,3.59.18.37.63.53,1,.34.37-.18.53-.63.34-1C13.76,1.8,11.04.1,8.01.1c-4.35,0-7.9,3.54-7.9,7.9Z" />
    </SvgIcon>
  );
});

IconRefresh.displayName = 'IconRefresh';

export {IconRefresh};
