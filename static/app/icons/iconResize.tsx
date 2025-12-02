import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconResize(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M8.25 1C8.66 1 9 1.34 9 1.75C9 2.17 8.66 2.5 8.25 2.5H3.56L13.5 12.44V7.75C13.5 7.34 13.83 7 14.25 7C14.66 7 15 7.34 15 7.75V14.25C15 14.66 14.66 15 14.25 15H7.75C7.34 15 7 14.66 7 14.25C7 13.83 7.34 13.5 7.75 13.5H12.44L2.5 3.56V8.25C2.5 8.66 2.16 9 1.75 9C1.34 9 1 8.66 1 8.25V1.75C1 1.34 1.34 1 1.75 1H8.25Z" />
      ) : (
        <path d="M1.5,2.61l12,11.9H8A.75.75,0,0,0,8,16h7.25a.75.75,0,0,0,.75-.75V8a.75.75,0,0,0-1.5,0v5.43L2.57,1.55H8A.75.75,0,0,0,8,.05H.75A.76.76,0,0,0,0,.8V8a.75.75,0,0,0,.75.75A.74.74,0,0,0,1.5,8Z" />
      )}
    </SvgIcon>
  );
}
