import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconRepeat = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="m3.66,16.04c-.19,0-.38-.07-.53-.22L.26,12.94c-.29-.29-.29-.77,0-1.06l2.88-2.88c.29-.29.77-.29,1.06,0s.29.77,0,1.06l-2.34,2.34,2.34,2.35c.29.29.29.77,0,1.06-.15.15-.34.22-.53.22Z" />
      <path d="m13.21,13.16H.79c-.41,0-.75-.34-.75-.75s.34-.75.75-.75h12.42c.69,0,1.25-.56,1.25-1.25V2.83c0-.69-.56-1.25-1.25-1.25H2.8c-.69,0-1.25.56-1.25,1.25v5.81c0,.41-.34.75-.75.75s-.75-.34-.75-.75V2.83C.05,1.31,1.28.08,2.8.08h10.42c1.52,0,2.75,1.23,2.75,2.75v7.58c0,1.52-1.23,2.75-2.75,2.75Z" />
    </SvgIcon>
  );
});

IconRepeat.displayName = 'IconRepeat';

export {IconRepeat};
