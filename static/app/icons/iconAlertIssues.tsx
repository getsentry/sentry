import * as React from 'react';

import SvgIcon, {SVGIconProps} from './svgIcon';

const IconAlertIssues = React.forwardRef<SVGSVGElement, SVGIconProps>(
  ({...props}, ref) => {
    return (
      <SvgIcon {...props} ref={ref}>
        <rect
          width="11.7333"
          height="11.7333"
          rx="2"
          transform="scale(1.01739 .9823) rotate(45 4.2962 9.2981)"
          fill="#80708F"
        />
        <g clipPath="url(#a)" fill="#fff">
          <path d="M9.8906 10.7743h-3.85A1.0086 1.0086 0 0 1 5.036 9.7696v-3.85a1.0081 1.0081 0 0 1 1.0046-1.012h3.85a1.0082 1.0082 0 0 1 1.012 1.012v3.85a1.0092 1.0092 0 0 1-.2979.7119 1.0082 1.0082 0 0 1-.714.2928Zm-3.85-5.313a.4583.4583 0 0 0-.4583.4583v3.85a.4584.4584 0 0 0 .4583.4583h3.85a.4584.4584 0 0 0 .4584-.4583v-3.85a.4582.4582 0 0 0-.4584-.4583h-3.85Z" />
          <path d="M10.624 5.8646H5.3074v.55h5.3166v-.55ZM10.624 6.8362H5.3074v.55h5.3166v-.55ZM8.9924 9.337H6.939a.4584.4584 0 0 1-.4583-.4584v-.517H5.3073a.275.275 0 1 1 0-.55H6.774a.2787.2787 0 0 1 .275.275v.7003h1.87v-.7003a.2787.2787 0 0 1 .275-.275h1.4667a.2748.2748 0 0 1 .275.275.275.275 0 0 1-.275.275H9.436v.517a.4584.4584 0 0 1-.4436.4583Z" />
        </g>
        <defs>
          <clipPath id="a">
            <path
              fill="#fff"
              transform="translate(5.036 4.9076)"
              d="M0 0h5.8667v5.8667H0z"
            />
          </clipPath>
        </defs>
      </SvgIcon>
    );
  }
);

IconAlertIssues.displayName = 'IconAlertIssues';

export {IconAlertIssues};
