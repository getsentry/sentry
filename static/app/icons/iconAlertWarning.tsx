import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconAlertWarning = React.forwardRef<SVGSVGElement, SVGIconProps>(
  ({...props}, ref) => {
    return (
      <SvgIcon {...props} ref={ref}>
        <rect
          width="11.7333"
          height="11.7333"
          rx="2"
          transform="matrix(.7194 .6946 -.7194 .6946 8 -.1499)"
          fill="#F5B000"
        />
        <g clipPath="url(#a)" fill="#fff">
          <path d="M8.4451 4.4711V8.978c0 .1878-.178.3004-.4154.3004s-.4748-.1126-.4748-.3004V4.4711c0-.1502.178-.3004.4748-.3004.2967 0 .4154.1502.4154.3004ZM8 10.4757c-.3391 0-.614.2841-.614.6345 0 .3504.2749.6345.614.6345.339 0 .614-.2841.614-.6345 0-.3504-.275-.6345-.614-.6345Z" />
        </g>
        <defs>
          <clipPath id="a">
            <path
              fill="#fff"
              transform="rotate(-90 8.0201 4.0398)"
              d="M0 0h8.3265v8.0394H0z"
            />
          </clipPath>
        </defs>
      </SvgIcon>
    );
  }
);

IconAlertWarning.displayName = 'IconAlertWarning';

export {IconAlertWarning};
