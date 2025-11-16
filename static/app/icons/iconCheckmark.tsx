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
        <path d="M13.7201 3.22018C14.013 2.92729 14.4877 2.92729 14.7806 3.22018C15.0731 3.51311 15.0734 3.98797 14.7806 4.28073L6.53064 12.5307C6.23788 12.8234 5.763 12.8232 5.47009 12.5307L1.22009 8.28073C0.92722 7.98786 0.92726 7.51308 1.22009 7.22018C1.51299 6.92729 1.98775 6.92729 2.28064 7.22018L6.00037 10.9399L13.7201 3.22018Z" />
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
