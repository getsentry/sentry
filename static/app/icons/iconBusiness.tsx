import {useMemo} from 'react';
import {keyframes, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {uniqueId} from 'sentry/utils/guid';

import {SvgIcon, type SVGIconProps} from './svgIcon';

// @TODO(jonasbadalic) does this need dark mode?
const businessIconColors = ['#EA5BC2', '#6148CE'] as const;

interface BusinessIconProps extends SVGIconProps {
  /**
   * Renders a pink purple gradient on the icon
   */
  gradient?: boolean;

  /**
   * Adds an animated shine to the icon
   */
  withShine?: boolean;
}

/**
 * @deprecated Use IconLightning instead, this icon will be removed in new UI.
 */
export function IconBusiness({
  gradient = false,
  withShine = false,
  ...props
}: BusinessIconProps) {
  const theme = useTheme();
  const uid = useMemo(() => uniqueId(), []);
  const maskId = `icon-business-mask-${uid}`;
  const gradientId = `icon-business-gradient-${uid}`;
  const shineId = `icon-business-shine-${uid}`;

  if (theme.isChonk) {
    return (
      <SvgIcon {...props}>
        <path d="M8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM8.62 3.6C8.8 3.43 9.1 3.6 9.04 3.84L8.33 6.69C8.29 6.85 8.41 7 8.57 7H12.38C12.6 7 12.71 7.27 12.55 7.43L7.38 12.4C7.2 12.57 6.9 12.4 6.96 12.16L7.67 9.31C7.71 9.15 7.59 9 7.43 9H3.62C3.4 9 3.29 8.73 3.45 8.57L8.62 3.6Z" />
      </SvgIcon>
    );
  }

  return (
    <SvgIcon {...props}>
      <mask id={maskId}>
        <path
          fill="white"
          d="M6.4 3.2C3.75 3.2 1.6 5.35 1.6 8C1.6 10.65 3.75 12.8 6.4 12.8H9.6C12.25 12.8 14.4 10.65 14.4 8C14.4 5.35 12.25 3.2 9.6 3.2H6.4ZM6.4 1.6H9.6C13.13 1.6 16 4.47 16 8C16 11.53 13.13 14.4 9.6 14.4H6.4C2.87 14.4 0 11.53 0 8C0 4.47 2.87 1.6 6.4 1.6ZM9.71 3.62L8.76 6.42C8.73 6.5 8.73 6.59 8.77 6.67C8.8 6.76 8.86 6.82 8.94 6.86L10.81 7.77C10.86 7.8 10.9 7.84 10.94 7.88C10.97 7.93 11 7.98 11.01 8.04C11.02 8.1 11.01 8.16 10.99 8.21C10.97 8.27 10.94 8.32 10.9 8.36L6.59 12.57C6.56 12.6 6.51 12.62 6.46 12.62C6.41 12.62 6.36 12.6 6.33 12.57C6.31 12.54 6.29 12.51 6.28 12.48C6.27 12.45 6.28 12.41 6.29 12.38L7.24 9.58C7.27 9.5 7.27 9.41 7.23 9.32C7.2 9.24 7.13 9.17 7.05 9.14L5.19 8.23C5.14 8.2 5.1 8.16 5.06 8.12C5.03 8.07 5 8.02 4.99 7.96C4.98 7.9 4.99 7.84 5.01 7.79C5.02 7.73 5.06 7.68 5.1 7.64L9.41 3.43C9.44 3.4 9.49 3.38 9.54 3.38C9.59 3.38 9.63 3.4 9.67 3.43C9.69 3.46 9.71 3.49 9.72 3.52C9.73 3.55 9.72 3.59 9.71 3.62Z"
        />
      </mask>
      <linearGradient id={gradientId}>
        <stop offset="0%" stopColor={businessIconColors[0]} />
        <stop offset="100%" stopColor={businessIconColors[1]} />
      </linearGradient>
      <linearGradient id={shineId} gradientTransform="rotate(35)">
        <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
        <stop offset="50%" stopColor="rgba(255, 255, 255, 1)" />
        <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
      </linearGradient>
      <rect
        fill={gradient ? `url(#${gradientId})` : 'inherit'}
        mask={`url(#${maskId})`}
        height="100%"
        width="100%"
      />

      {withShine && (
        <g mask={`url(#${maskId})`}>
          <ShineRect fill={`url(#${shineId})`} height="100%" width="100%" />
        </g>
      )}
    </SvgIcon>
  );
}

const shine = keyframes`
  0% {
    transform: translateX(-100%);
  }
  94% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
`;

const ShineRect = styled('rect')`
  transform: translateX(-100%);
  animation: ${shine} 8s ease-in-out infinite;
`;
