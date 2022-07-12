import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconReplayerNext = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 0.25C14.4142 0.25 14.75 0.585786 14.75 1V15C14.75 15.4142 14.4142 15.75 14 15.75C13.5858 15.75 13.25 15.4142 13.25 15V1C13.25 0.585786 13.5858 0.25 14 0.25Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.15364 0.334766C1.40169 0.205618 1.70099 0.225204 1.9301 0.385576L11.9301 7.38558C12.1306 7.52592 12.25 7.75526 12.25 8C12.25 8.24474 12.1306 8.47408 11.9301 8.61442L1.9301 15.6144C1.70099 15.7748 1.40169 15.7944 1.15364 15.6652C0.905593 15.5361 0.75 15.2797 0.75 15V1C0.75 0.720343 0.905593 0.463914 1.15364 0.334766ZM2.25 2.44049V13.5595L10.1922 8L2.25 2.44049Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
});

IconReplayerNext.displayName = 'IconReplayerNext';

export {IconReplayerNext};
