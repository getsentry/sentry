import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconArchive = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="m15.28,5.32H.72c-.41,0-.75-.34-.75-.75V.74C-.03.32.3-.01.72-.01h14.56c.41,0,.75.34.75.75v3.83c0,.41-.34.75-.75.75ZM1.47,3.82h13.06V1.49H1.47v2.33Z" />
      <path d="m12.53,16.03H3.47c-1.52,0-2.75-1.23-2.75-2.75V4.57c0-.41.34-.75.75-.75s.75.34.75.75v8.71c0,.69.56,1.25,1.25,1.25h9.05c.69,0,1.25-.56,1.25-1.25V4.57c0-.41.34-.75.75-.75s.75.34.75.75v8.71c0,1.52-1.23,2.75-2.75,2.75Z" />
      <path d="m10.67,7.7h-5.08c-.41,0-.75-.34-.75-.75s.34-.75.75-.75h5.08c.41,0,.75.34.75.75s-.34.75-.75.75Z" />
    </SvgIcon>
  );
});

IconArchive.displayName = 'IconArchive';

export {IconArchive};
