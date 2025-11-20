import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconPrevious(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M1.75 15C1.34 15 1 14.66 1 14.25L1 1.75C1 1.34 1.34 1 1.75 1C2.16 1 2.5 1.34 2.5 1.75L2.5 14.25C2.5 14.66 2.16 15 1.75 15ZM14.61 14.91C14.36 15.04 14.07 15.03 13.84 14.88L4.34 8.63C4.13 8.49 4 8.25 4 8C4 7.75 4.13 7.51 4.34 7.37L13.84 1.12C14.07 0.97 14.36 0.96 14.61 1.09C14.85 1.22 15 1.47 15 1.75L15 14.25C15 14.53 14.85 14.78 14.61 14.91ZM13.5 3.14L6.12 8L13.5 12.86L13.5 3.14Z" />
      ) : (
        <Fragment>
          <path d="M15.25,15.48a.69.69,0,0,1-.37-.1L3.22,8.65a.75.75,0,0,1,0-1.3L14.88.62a.75.75,0,0,1,.74,0,.73.73,0,0,1,.38.65V14.73a.73.73,0,0,1-.38.65A.69.69,0,0,1,15.25,15.48ZM5.09,8l9.41,5.43V2.57Z" />
          <path d="M.75,15.94A.76.76,0,0,1,0,15.19V.81A.76.76,0,0,1,.75.06.76.76,0,0,1,1.5.81V15.19A.76.76,0,0,1,.75,15.94Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
