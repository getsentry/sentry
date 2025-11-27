import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconNext(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M14.25 1C14.66 1 15 1.34 15 1.75V14.25C15 14.66 14.66 15 14.25 15C13.84 15 13.5 14.66 13.5 14.25V1.75C13.5 1.34 13.84 1 14.25 1ZM1.39 1.09C1.64 0.96 1.93 0.97 2.16 1.12L11.66 7.37C11.87 7.51 12 7.75 12 8C12 8.25 11.87 8.49 11.66 8.63L2.16 14.88C1.93 15.03 1.64 15.04 1.39 14.91C1.15 14.78 1 14.53 1 14.25V1.75C1 1.47 1.15 1.22 1.39 1.09ZM2.5 12.86L9.88 8L2.5 3.14V12.86Z" />
      ) : (
        <Fragment>
          <path d="M.75,15.48a.69.69,0,0,1-.37-.1A.73.73,0,0,1,0,14.73V1.27A.73.73,0,0,1,.38.62a.75.75,0,0,1,.74,0L12.78,7.35a.75.75,0,0,1,0,1.3L1.12,15.38A.69.69,0,0,1,.75,15.48ZM1.5,2.57V13.43L10.91,8Z" />
          <path d="M15.25,15.94a.76.76,0,0,1-.75-.75V.81a.75.75,0,1,1,1.5,0V15.19A.76.76,0,0,1,15.25,15.94Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
