import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconAllProjects(props: SVGIconProps) {
  const theme = useTheme();
  return theme.isChonk ? (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      <rect
        x="5"
        y="5"
        width="8.25"
        height="8.25"
        rx="1"
        ry="1"
        transform="translate(18.25 0) rotate(90)"
      />
      <path d="M2.75,9.5V3.75c0-.55.45-1,1-1h5.75" />
      <line x1="7.75" y1="7.75" x2="10.5" y2="7.75" />
      <line x1="7.75" y1="10.5" x2="10.5" y2="10.5" />
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

IconAllProjects.displayName = 'IconAllProjects';

export {IconAllProjects};
