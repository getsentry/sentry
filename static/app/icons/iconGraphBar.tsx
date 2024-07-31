import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconGraphBar = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M6.63,15.99H.74c-.41,0-.75-.34-.75-.75V6.71c0-.41.34-.75.75-.75h5.9c.41,0,.75.34.75.75v8.53c0,.41-.34.75-.75.75ZM1.49,14.49h4.4v-7.03H1.49v7.03Z" />
      <path d="M15.25,15.99h-5.67c-.41,0-.75-.34-.75-.75V.76c0-.41.34-.75.75-.75h5.67c.41,0,.75.34.75.75v14.48c0,.41-.34.75-.75.75ZM10.33,14.49h4.17V1.51h-4.17v12.98Z" />
    </SvgIcon>
  );
});

IconGraphBar.displayName = 'IconGraphBar';

export {IconGraphBar};
