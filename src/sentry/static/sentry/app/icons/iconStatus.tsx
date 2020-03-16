import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconStatus = React.forwardRef(function IconStatus(
  {size: providedSize = 'sm', type: providedType = 'neutral', ...props}: IconProps,
  ref: React.Ref<SVGSVGElement>
) {
  const size = theme.iconSizes[providedSize] ?? providedSize;

  const good = (
    <svg viewBox="0 0 16 16" height={size} width={size} {...props} ref={ref}>
      <circle cx="8" cy="8" r="7.97" style={{fill: '#5abc70'}} />
      <circle cx="4.64" cy="6.02" r="0.87" style={{fill: '#084d27'}} />
      <circle cx="11.36" cy="6.02" r="0.87" style={{fill: '#084d27'}} />
      <path
        d="M8,12.43a5.4,5.4,0,0,1-5.2-4,.49.49,0,0,1,.35-.61.5.5,0,0,1,.61.35,4.4,4.4,0,0,0,8.48,0,.5.5,0,0,1,1,.26A5.4,5.4,0,0,1,8,12.43Z"
        style={{fill: '#084d27'}}
      />
    </svg>
  );

  const neutral = (
    <svg viewBox="0 0 16 16" height={size} width={size} {...props} ref={ref}>
      <circle cx="8" cy="8" r="7.97" style={{fill: '#ffc228'}} />
      <circle cx="4.64" cy="6.02" r="0.87" style={{fill: '#b3882d'}} />
      <circle cx="11.36" cy="6.02" r="0.87" style={{fill: '#b3882d'}} />
      <path
        d="M12.54,10.27H3.46a.5.5,0,0,1-.5-.5.5.5,0,0,1,.5-.5h9.08a.5.5,0,0,1,.5.5A.5.5,0,0,1,12.54,10.27Z"
        style={{fill: '#b3882d'}}
      />
    </svg>
  );

  const bad = (
    <svg viewBox="0 0 16 16" height={size} width={size} {...props} ref={ref}>
      <circle cx="8" cy="8" r="7.97" style={{fill: '#f0494a'}} />
      <circle cx="4.64" cy="6.02" r="0.87" style={{fill: '#781215'}} />
      <circle cx="11.36" cy="6.02" r="0.87" style={{fill: '#781215'}} />
      <path
        d="M12.72,12.43a.5.5,0,0,1-.48-.37,4.4,4.4,0,0,0-8.48,0,.5.5,0,1,1-1-.27,5.39,5.39,0,0,1,10.4,0,.5.5,0,0,1-.35.62Z"
        style={{fill: '#781215'}}
      />
    </svg>
  );

  switch (providedType) {
    case 'good':
      return good;
    case 'bad':
      return bad;
    default:
      return neutral;
  }
});
