import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconReplayerPlay = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.15364 0.334766C3.40169 0.205618 3.70099 0.225204 3.9301 0.385576L13.9301 7.38558C14.1306 7.52592 14.25 7.75526 14.25 8C14.25 8.24474 14.1306 8.47408 13.9301 8.61442L3.9301 15.6144C3.70099 15.7748 3.40169 15.7944 3.15364 15.6652C2.90559 15.5361 2.75 15.2797 2.75 15V1C2.75 0.720343 2.90559 0.463914 3.15364 0.334766ZM4.25 2.44049V13.5595L12.1922 8L4.25 2.44049Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
});

IconReplayerPlay.displayName = 'IconReplayerPlay';

export {IconReplayerPlay};
