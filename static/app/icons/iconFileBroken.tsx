import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconFileBroken = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="m13.33,16.01H2.67c-.96,0-1.75-.79-1.75-1.75V1.74C.92.78,1.7,0,2.67,0h6.15c.2,0,.39.08.53.22l5.52,5.52c.14.14.22.33.22.53v8c0,.96-.79,1.75-1.75,1.75ZM2.67,1.49c-.14,0-.25.11-.25.25v12.52c0,.14.11.25.25.25h10.67c.14,0,.25-.11.25-.25v-7.69L8.5,1.49H2.67Z" />
      <path d="m14.33,7.01h-4.52c-.96,0-1.75-.79-1.75-1.75V.74c0-.41.34-.75.75-.75s.75.34.75.75v4.52c0,.14.11.25.25.25h4.52c.41,0,.75.34.75.75s-.34.75-.75.75Z" />
      <path d="m1.23,15.51c-.19,0-.38-.07-.53-.22-.29-.29-.29-.77,0-1.06L14.24.68c.29-.29.77-.29,1.06,0s.29.77,0,1.06L1.76,15.29c-.15.15-.34.22-.53.22Z" />
    </SvgIcon>
  );
});

IconFileBroken.displayName = 'IconFileBroken';

export {IconFileBroken};
