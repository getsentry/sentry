import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconReplayerFullscreenEnter = forwardRef<SVGSVGElement, SVGIconProps>(
  (props, ref) => {
    return (
      <SvgIcon {...props} ref={ref}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M0.25 1.5C0.25 1.08579 0.585787 0.75 1 0.75H5C5.41421 0.75 5.75 1.08579 5.75 1.5C5.75 1.91421 5.41421 2.25 5 2.25H1.75V5.5C1.75 5.91421 1.41421 6.25 1 6.25C0.585787 6.25 0.25 5.91421 0.25 5.5V1.5Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M15 0.75C15.4142 0.75 15.75 1.08579 15.75 1.5V5.5C15.75 5.91421 15.4142 6.25 15 6.25C14.5858 6.25 14.25 5.91421 14.25 5.5V2.25L11 2.25C10.5858 2.25 10.25 1.91421 10.25 1.5C10.25 1.08579 10.5858 0.75 11 0.75L15 0.75Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1 9.75C1.41421 9.75 1.75 10.0858 1.75 10.5L1.75 13.75H5C5.41421 13.75 5.75 14.0858 5.75 14.5C5.75 14.9142 5.41421 15.25 5 15.25H1C0.801088 15.25 0.610322 15.171 0.46967 15.0303C0.329018 14.8897 0.25 14.6989 0.25 14.5L0.25 10.5C0.25 10.0858 0.585786 9.75 1 9.75ZM15 9.75C15.4142 9.75 15.75 10.0858 15.75 10.5L15.75 14.5C15.75 14.9142 15.4142 15.25 15 15.25H11C10.5858 15.25 10.25 14.9142 10.25 14.5C10.25 14.0858 10.5858 13.75 11 13.75H14.25L14.25 10.5C14.25 10.0858 14.5858 9.75 15 9.75Z"
          fill="currentColor"
        />
      </SvgIcon>
    );
  }
);

IconReplayerFullscreenEnter.displayName = 'IconReplayerFullscreenEnter';

export {IconReplayerFullscreenEnter};
