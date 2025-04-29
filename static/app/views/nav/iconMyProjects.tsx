import {useTheme} from '@emotion/react';

export function IconMyProjects() {
  const theme = useTheme();

  const commonStyles = {
    fill: 'none',
    stroke: theme.gray400,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
    >
      {/* <rect
        x="0.5"
        y="0.5"
        width="13"
        height="13"
        rx="2"
        fill={theme.surface100}
        stroke={theme.gray400}
        strokeWidth="1.25"
      /> */}
      <rect
        x="0.5"
        y="0.5"
        width="17"
        height="17"
        rx="3"
        fill={theme.gray100}
        stroke={theme.gray300}
        strokeWidth="1.25"
      />
      {/* Smiley */}
      <path
        d="M7,11c2,1.2,2,1.2,4,0"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={theme.gray300}
      />
      <circle cx="12" cy="7" r=".65" stroke={theme.gray300} fill={theme.gray300} />
      <circle cx="6" cy="7" r=".65" stroke={theme.gray300} fill={theme.gray300} />
    </svg>
  );
}
