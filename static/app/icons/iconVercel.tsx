import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconVercel(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M15.87 15H-0.13L7.87 1L15.87 15Z" />
      ) : (
        <path d="M13.25,0H2.75A2.75,2.75,0,0,0,0,2.76v10.5A2.75,2.75,0,0,0,2.75,16h10.5A2.75,2.75,0,0,0,16,13.26V2.76A2.75,2.75,0,0,0,13.25,0ZM3.74,11.28,8,3.86l4.26,7.42Z" />
      )}
    </SvgIcon>
  );
}
