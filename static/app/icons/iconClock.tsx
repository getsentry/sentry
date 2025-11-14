import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconClock(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M8 0C12.4183 3.29857e-05 16 3.58174 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C1.77178e-07 3.58172 3.58172 1.7717e-07 8 0ZM8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5C11.5898 14.5 14.5 11.5898 14.5 8C14.5 4.41017 11.5898 1.50003 8 1.5ZM7.75 4C8.16418 4.00004 8.5 4.33581 8.5 4.75V8.10938L10.6797 9.63574C11.0189 9.87323 11.1016 10.3404 10.8643 10.6797C10.6268 11.0189 10.1596 11.1016 9.82031 10.8643L7.32031 9.11426L7 8.89062V4.75C7 4.33579 7.33579 4 7.75 4Z" />
      ) : (
        <Fragment>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.52A6.48,6.48,0,1,0,14.48,8,6.49,6.49,0,0,0,8,1.52Z" />
          <path d="M11.62,8.75H8A.76.76,0,0,1,7.25,8V2.88a.75.75,0,1,1,1.5,0V7.25h2.87a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
