import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  isCircled?: boolean;
}

export function IconCheckmark({isCircled = false, ...props}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} data-test-id="icon-check-mark">
      {theme.isChonk ? (
        <path d="M13.72 3.22C14.01 2.93 14.49 2.93 14.78 3.22C15.07 3.51 15.07 3.99 14.78 4.28L6.53 12.53C6.24 12.82 5.76 12.82 5.47 12.53L1.22 8.28C0.93 7.99 0.93 7.51 1.22 7.22C1.51 6.93 1.99 6.93 2.28 7.22L6 10.94L13.72 3.22Z" />
      ) : isCircled ? (
        <Fragment>
          <path d="M7,12a.78.78,0,0,1-.57-.26L4,9.05A.76.76,0,0,1,4.07,8a.75.75,0,0,1,1.06.07l1.75,2L10.77,4.3A.75.75,0,0,1,12,5.14L7.58,11.7A.77.77,0,0,1,7,12Z" />
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
        </Fragment>
      ) : (
        <path d="M6.19,14.51a.77.77,0,0,1-.57-.25l-4.2-4.8a.75.75,0,0,1,1.13-1l3.56,4.06L13.36,1.82a.75.75,0,0,1,1-.21.76.76,0,0,1,.21,1.05L6.81,14.18a.73.73,0,0,1-.58.33Z" />
      )}
    </SvgIcon>
  );
}
