import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconMyProjects(props: SVGIconProps) {
  const theme = useTheme();
  return theme.isChonk ? (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      <rect
        x="5.02"
        y="5"
        width="8.25"
        height="8.25"
        rx="1"
        ry="1"
        transform="translate(18.27 -.02) rotate(90)"
      />
      <path d="M2.77,9.5V3.75c0-.55.45-1,1-1h5.75" />
      <path d="M7.52,10.17c.78.78,2.34.78,3.25,0" />
      <circle cx="10.52" cy="7.75" r=".25" />
      <circle cx="7.77" cy="7.75" r=".25" />
    </SvgIcon>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
    >
      <rect width="13" height="13" rx="2" fill={theme.gray200} />
      <rect
        x="0.5"
        y="0.5"
        width="12"
        height="12"
        rx="1.5"
        stroke={theme.gray400}
        strokeOpacity="0.14"
      />
      <rect x="4" y="4" width="13" height="13" rx="2" fill={theme.gray200} />
      <rect
        x="4.5"
        y="4.5"
        width="12"
        height="12"
        rx="1.5"
        stroke={theme.gray400}
        strokeOpacity="0.14"
      />
    </svg>
  );
}

IconMyProjects.displayName = 'IconMyProjects';

export {IconMyProjects};
