import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconFlag = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M1.69,8.43V2.22H13.53l-2,2.65a.78.78,0,0,0,0,.92l2,2.64Zm0-7.7A.74.74,0,0,0,.94.09.75.75,0,0,0,.19.84V15.16a.75.75,0,0,0,1.5,0V9.93H15.06a.75.75,0,0,0,.59-1.21L13,5.33l2.62-3.4a.73.73,0,0,0,.08-.79.75.75,0,0,0-.67-.42H1.69" />
    </SvgIcon>
  );
});

IconFlag.displayName = 'IconFlag';

export {IconFlag};
