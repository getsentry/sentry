import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconToggle = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <circle cx="5.36" cy="8" r="3.08" />
      <path d="M10.68,13.34H5.32a5.34,5.34,0,0,1,0-10.68h5.36a5.34,5.34,0,0,1,0,10.68ZM5.32,4.16a3.84,3.84,0,0,0,0,7.68h5.36a3.84,3.84,0,0,0,0-7.68Z" />
    </SvgIcon>
  );
});

IconToggle.displayName = 'IconToggle';

export {IconToggle};
