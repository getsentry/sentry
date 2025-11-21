import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconFlag(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M2.75 0C3.16 0 3.5 0.34 3.5 0.75V2H15.25C15.55 2 15.82 2.18 15.94 2.45C16.05 2.72 16 3.04 15.8 3.26L12.77 6.5L15.8 9.74C16 9.96 16.05 10.28 15.94 10.55C15.82 10.82 15.55 11 15.25 11H3.5V14.25C3.5 14.66 3.16 15 2.75 15C2.34 15 2 14.66 2 14.25V0.75C2 0.34 2.34 0 2.75 0ZM3.5 9.5H13.52L11.2 7.01C10.93 6.72 10.93 6.28 11.2 5.99L13.52 3.5H3.5V9.5Z" />
      ) : (
        <path d="M1.69,8.43V2.22H13.53l-2,2.65a.78.78,0,0,0,0,.92l2,2.64Zm0-7.7A.74.74,0,0,0,.94.09.75.75,0,0,0,.19.84V15.16a.75.75,0,0,0,1.5,0V9.93H15.06a.75.75,0,0,0,.59-1.21L13,5.33l2.62-3.4a.73.73,0,0,0,.08-.79.75.75,0,0,0-.67-.42H1.69" />
      )}
    </SvgIcon>
  );
}
