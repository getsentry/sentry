import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconReplayerFullscreenExit = forwardRef<SVGSVGElement, SVGIconProps>(
  (props, ref) => {
    return (
      <SvgIcon {...props} ref={ref}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5 0.75C5.41421 0.75 5.75 1.08579 5.75 1.5L5.75 5.5C5.75 5.91421 5.41421 6.25 5 6.25L1 6.25C0.585786 6.25 0.25 5.91421 0.25 5.5C0.25 5.08579 0.585786 4.75 1 4.75L4.25 4.75L4.25 1.5C4.25 1.08579 4.58579 0.75 5 0.75ZM11 0.75C11.4142 0.75 11.75 1.08579 11.75 1.5V4.75H15C15.4142 4.75 15.75 5.08579 15.75 5.5C15.75 5.91421 15.4142 6.25 15 6.25H11C10.5858 6.25 10.25 5.91421 10.25 5.5V1.5C10.25 1.08579 10.5858 0.75 11 0.75Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M0.25 10.5C0.25 10.0858 0.585786 9.75 1 9.75H5C5.41421 9.75 5.75 10.0858 5.75 10.5V14.5C5.75 14.9142 5.41421 15.25 5 15.25C4.58579 15.25 4.25 14.9142 4.25 14.5V11.25H1C0.585786 11.25 0.25 10.9142 0.25 10.5ZM10.25 10.5C10.25 10.0858 10.5858 9.75 11 9.75H15C15.4142 9.75 15.75 10.0858 15.75 10.5C15.75 10.9142 15.4142 11.25 15 11.25H11.75V14.5C11.75 14.9142 11.4142 15.25 11 15.25C10.5858 15.25 10.25 14.9142 10.25 14.5V10.5Z"
          fill="currentColor"
        />
      </SvgIcon>
    );
  }
);

IconReplayerFullscreenExit.displayName = 'IconReplayerFullscreenExit';

export {IconReplayerFullscreenExit};
