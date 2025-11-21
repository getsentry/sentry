import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGraphCircle(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M7 9V3.5C3.96 3.5 1.5 5.96 1.5 9C1.5 12.04 3.96 14.5 7 14.5C8.74 14.5 10.3 13.69 11.31 12.42C12.05 11.48 12.5 10.29 12.5 9H7ZM8.5 7.5H14.46C14.11 4.37 11.63 1.89 8.5 1.54V7.5ZM14 9C14 10.65 13.43 12.16 12.48 13.36C11.2 14.97 9.22 16 7 16C3.13 16 0 12.87 0 9C0 5.13 3.13 2 7 2V-0H7.75C12.31 -0 16 3.69 16 8.25V9H14Z" />
      ) : (
        <Fragment>
          <path d="M13.1,15.09a.74.74,0,0,1-.5-.2l-6-5.48a.76.76,0,0,1-.24-.55V.76A.76.76,0,0,1,7.14,0a8.85,8.85,0,0,1,6.52,14.84A.76.76,0,0,1,13.1,15.09ZM7.89,8.53,13,13.25A7.34,7.34,0,0,0,7.89,1.55Z" />
          <path d="M7.14,16a7.13,7.13,0,0,1,0-14.26v1.5a5.63,5.63,0,1,0,4.15,9.44l1.1,1A7.12,7.12,0,0,1,7.14,16Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
