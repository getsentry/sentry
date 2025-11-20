import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconTag(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M8.5 1C8.7 1 8.9 1.08 9.04 1.23L15.79 8.23C16.07 8.52 16.07 8.99 15.78 9.28L9.28 15.78C8.99 16.07 8.52 16.07 8.23 15.79L1.23 9.04C1.08 8.9 1 8.7 1 8.5V2.25C1 1.56 1.56 1 2.25 1H8.5ZM2.5 8.18L8.74 14.2L14.2 8.74L8.18 2.5H2.5V8.18ZM5.5 4C6.33 4 7 4.67 7 5.5C7 6.33 6.33 7 5.5 7C4.67 7 4 6.33 4 5.5C4 4.67 4.67 4 5.5 4Z" />
      ) : (
        <Fragment>
          <path d="M3.87,5.7A1.81,1.81,0,1,1,5.69,3.89,1.82,1.82,0,0,1,3.87,5.7Zm0-2.12a.31.31,0,1,0,.32.31A.31.31,0,0,0,3.87,3.58Z" />
          <path d="M8,16a.77.77,0,0,1-.53-.21L.24,8.53A.75.75,0,0,1,0,8V.79A.75.75,0,0,1,.77,0H8a.74.74,0,0,1,.53.21l7.22,7.22a.75.75,0,0,1,0,1.06L8.51,15.75A.74.74,0,0,1,8,16ZM1.52,7.69,8,14.15,14.14,8,7.67,1.54H1.52Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
