import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconReplayerPause = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.75 1.5C0.75 1.08579 1.08579 0.75 1.5 0.75H6.5C6.91421 0.75 7.25 1.08579 7.25 1.5V14.5C7.25 14.9142 6.91421 15.25 6.5 15.25H1.5C1.08579 15.25 0.75 14.9142 0.75 14.5V1.5ZM2.25 2.25V13.75H5.75V2.25H2.25Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.75 1.5C8.75 1.08579 9.08579 0.75 9.5 0.75H14.5C14.9142 0.75 15.25 1.08579 15.25 1.5V14.5C15.25 14.9142 14.9142 15.25 14.5 15.25H9.5C9.08579 15.25 8.75 14.9142 8.75 14.5V1.5ZM10.25 2.25V13.75H13.75V2.25H10.25Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
});

IconReplayerPause.displayName = 'IconReplayerPause';

export {IconReplayerPause};
