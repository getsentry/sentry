import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconGraphLine = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M4.38,15.99c-.28,0-.54-.16-.67-.41L.09,8.34c-.19-.37-.04-.82.34-1.01.37-.18.82-.03,1.01.34l2.95,5.9L10.95.42c.13-.25.39-.41.67-.41h0c.28,0,.54.16.67.42l3.62,7.26c.19.37.03.82-.34,1.01-.37.18-.82.03-1.01-.34l-2.95-5.91-6.57,13.14c-.13.25-.39.41-.67.41Z" />
    </SvgIcon>
  );
});

IconGraphLine.displayName = 'IconGraphLine';

export {IconGraphLine};
