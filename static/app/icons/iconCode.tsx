import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconCode = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M10.2,13.79c-.19,0-.38-.07-.53-.22-.29-.29-.29-.77,0-1.06l4.52-4.52-4.52-4.52c-.29-.29-.29-.77,0-1.06s.77-.29,1.06,0l5.05,5.05c.29.29.29.77,0,1.06l-5.05,5.05c-.15.15-.34.22-.53.22Z" />
      <path d="M5.8,13.8c-.19,0-.38-.07-.53-.22L.22,8.53c-.29-.29-.29-.77,0-1.06L5.27,2.42c.29-.29.77-.29,1.06,0s.29.77,0,1.06L1.81,8l4.52,4.52c.29.29.29.77,0,1.06-.15.15-.34.22-.53.22Z" />
    </SvgIcon>
  );
});

IconCode.displayName = 'IconCode';

export {IconCode};
