import {forwardRef} from 'react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface IconShowProps extends SVGIconProps {
  isHidden?: boolean;
}

const IconShow = forwardRef<SVGSVGElement, IconShowProps>(
  ({isHidden = false, ...props}, ref) => {
    return (
      <SvgIcon {...props} ref={ref}>
        <path d="M8,14.16c-3.67,0-6.18-1.87-7.9-5.86a.78.78,0,0,1,0-.6c1.72-4,4.23-5.86,7.9-5.86s6.18,1.87,7.9,5.86a.78.78,0,0,1,0,.6C14.18,12.29,11.67,14.16,8,14.16ZM1.61,8C3.07,11.22,5.05,12.66,8,12.66S12.93,11.22,14.39,8C12.93,4.78,11,3.34,8,3.34S3.07,4.78,1.61,8Z" />
        {isHidden ? (
          <path d="M1.23,15.47a.75.75,0,0,1-.53-.22.74.74,0,0,1,0-1.06L14.24.64a.75.75,0,0,1,1.06,0,.74.74,0,0,1,0,1.06L1.76,15.25A.79.79,0,0,1,1.23,15.47Z" />
        ) : null}
        <circle cx="8" cy="8" r="3.61" />
      </SvgIcon>
    );
  }
);

IconShow.displayName = 'IconShow';

export {IconShow};
