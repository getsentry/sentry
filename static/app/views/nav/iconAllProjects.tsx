import {useTheme} from '@emotion/react';

export function IconAllProjects() {
  const theme = useTheme();

  return (
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
