import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconAllProjects(props: SVGIconProps) {
  const theme = useTheme();
  return theme.isChonk ? (
    <SvgIcon {...props}>
      <path d="M11.25 0C12.22 0 13 0.78 13 1.75V3H14.25C15.22 3 16 3.78 16 4.75V14.25C16 15.22 15.22 16 14.25 16H4.75C3.78 16 3 15.22 3 14.25V13H1.75C0.78 13 0 12.22 0 11.25V1.75C0 0.78 0.78 0 1.75 0H11.25ZM4.75 4.5C4.61 4.5 4.5 4.61 4.5 4.75V14.25C4.5 14.39 4.61 14.5 4.75 14.5H14.25C14.39 14.5 14.5 14.39 14.5 14.25V4.75C14.5 4.61 14.39 4.5 14.25 4.5H4.75ZM12 10.5C12.41 10.5 12.75 10.84 12.75 11.25C12.75 11.66 12.41 12 12 12H7C6.59 12 6.25 11.66 6.25 11.25C6.25 10.84 6.59 10.5 7 10.5H12ZM1.75 1.5C1.61 1.5 1.5 1.61 1.5 1.75V11.25C1.5 11.39 1.61 11.5 1.75 11.5H3V4.75C3 3.78 3.78 3 4.75 3H11.5V1.75C11.5 1.61 11.39 1.5 11.25 1.5H1.75ZM12 7C12.41 7 12.75 7.34 12.75 7.75C12.75 8.16 12.41 8.5 12 8.5H7C6.59 8.5 6.25 8.16 6.25 7.75C6.25 7.34 6.59 7 7 7H12Z" />
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
