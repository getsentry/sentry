import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconAlertResolved = React.forwardRef<SVGSVGElement, SVGIconProps>(
  ({...props}, ref) => {
    return (
      <SvgIcon {...props} ref={ref}>
        <rect
          width="11.7333"
          height="11.7333"
          rx="2"
          transform="scale(1.01739 .9823) rotate(45 4.2962 9.2981)"
          fill="#2BA185"
        />
        <g clip-path="url(#a)">
          <path
            d="M7.116 11.3333c-.097 0-.1939-.047-.2908-.141L4.7904 8.9827c-.1453-.141-.0969-.3762.0484-.5172.1454-.141.3392-.094.4845.047l1.7442 1.9276 3.5367-5.0305c.0969-.141.3391-.188.4845-.094.1453.094.1938.329.0969.4701l-3.779 5.4066c-.0969.094-.1938.141-.2907.141Z"
            fill="#fff"
          />
        </g>
        <defs>
          <clipPath id="a">
            <path
              fill="#fff"
              transform="translate(4.236 4.8)"
              d="M0 0h7.4667v7.4667H0z"
            />
          </clipPath>
        </defs>
      </SvgIcon>
    );
  }
);

IconAlertResolved.displayName = 'IconAlertResolved';

export {IconAlertResolved};
