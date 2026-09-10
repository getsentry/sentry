import {Fragment, useId} from 'react';
import {useTheme} from '@emotion/react';
import {useReducedMotion} from 'framer-motion';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';
import {useIconDefaults} from './useIconDefaults';

interface IconSeerProps extends SVGIconProps {
  animation?: 'idle' | 'loading';
}

const bodyPath =
  'M8.01759 0.25C8.23262 0.249787 8.43757 0.341936 8.58009 0.50293C9.70729 1.77804 11.2269 3.70119 12.626 5.82324C13.9841 7.8832 15.2561 10.1746 15.9317 12.2656C15.9736 12.3357 16.005 12.4135 16.0225 12.4971C16.0949 12.8447 15.9134 13.1959 15.5879 13.3379C13.4024 14.2912 11.151 15 8.01857 15C4.88669 15 2.63318 14.2943 0.451185 13.3457C0.17589 13.226 -0.00176762 12.9535 1.33514e-05 12.6533C0.00080069 12.526 0.0359022 12.4049 0.0947399 12.2979C0.767604 10.203 2.04619 7.9014 3.41115 5.83105C4.81012 3.70913 6.32944 1.78347 7.45607 0.503906L7.51173 0.447266C7.64909 0.321318 7.82933 0.250248 8.01759 0.25ZM13.666 10.6562C12.0686 11.1903 10.117 11.5 8.01857 11.5C5.92124 11.5 3.96583 11.1911 2.37111 10.6572C2.11538 11.1963 1.88727 11.7258 1.69923 12.2402C3.54489 12.9877 5.45222 13.5 8.01857 13.5C10.5835 13.5 12.4883 12.9863 14.336 12.2354C14.1485 11.7218 13.9206 11.1939 13.666 10.6562ZM8.01954 2.15234C7.51245 2.75664 6.94957 3.46183 6.37013 4.23438C6.89523 4.08216 7.44681 4.00003 8.01857 4C8.59213 4.00002 9.14526 4.08221 9.67189 4.23535C9.09134 3.46176 8.52751 2.756 8.01954 2.15234Z';

const eyePath =
  'M8.01857 5.5C5.93882 5.50013 4.03972 6.99814 3.14259 9.3291C4.50943 9.74712 6.18916 9.99997 8.01857 10C9.84849 9.99998 11.5258 9.74671 12.8955 9.32812C11.9966 6.998 10.098 5.50012 8.01857 5.5Z';

// 32x32 viewBox paths for the idle spin animation (stroked, not filled).
const IDLE_BODY =
  'M16 2C11.58 7.02 4.02 17.18 1.5 25.3L1.463 25.316C5.701 27.158 10 28.5 16 28.5C22 28.5 26.295 27.152 30.54 25.3L30.5 25.3C27.98 17.16 20.42 7 16 2Z';
const IDLE_EYE =
  'M27.649 19.599C24.5 20.785 20.443 21.5 16 21.5C11.559 21.5 7.494 20.785 4.355 19.6C6.02 13.72 10.6 9.5 16 9.5C21.414 9.5 25.985 13.766 27.649 19.599Z';
const IDLE_SWEEP_LEFT = 'M16 2C11.568 7.025 3.995 17.191 1.463 25.316';
const IDLE_SWEEP_RIGHT = 'M16 2C20.432 6.98 28.005 17.16 30.54 25.3';

// Faux-3D pyramid spin. Two eye copies crossfade with scaleX squish;
// two sweep paths morph via CSS `d` to draw the rotating crease line.
// Transform chain per eye: translate to pivot, rotate, scaleX, translate
// back to origin. Values extracted from the SMIL reference animation.
const idleStyles = `
@keyframes seerR {
  0%      { visibility: visible; transform: translate(16px,18px) rotate(0deg) scale(1,1) translate(-16px,-18px); }
  8%      { visibility: visible; transform: translate(16.06px,18px) rotate(-0.1deg) scale(0.995,1) translate(-16px,-18px); }
  16%     { visibility: visible; transform: translate(17.1px,18px) rotate(-1.9deg) scale(0.899,1) translate(-16px,-18px); }
  25%     { visibility: visible; transform: translate(18.9px,18px) rotate(-4.93deg) scale(0.734,1) translate(-16px,-18px); }
  33%     { visibility: visible; transform: translate(20.93px,18px) rotate(-8.22deg) scale(0.548,1) translate(-16px,-18px); }
  41%     { visibility: visible; transform: translate(23.29px,18px) rotate(-11.75deg) scale(0.332,1) translate(-16px,-18px); }
  47%     { visibility: visible; transform: translate(26.41px,18px) rotate(-15.87deg) scale(0.045,1) translate(-16px,-18px); }
  47.99%  { visibility: visible; transform: translate(26.41px,18px) rotate(-16deg) scale(0.001,1) translate(-16px,-18px); }
  48%     { visibility: hidden;  transform: translate(26.41px,18px) rotate(-16deg) scale(0.001,1) translate(-16px,-18px); }
  93.99%  { visibility: hidden;  transform: translate(16px,18px) rotate(0deg) scale(0.001,1) translate(-16px,-18px); }
  94%     { visibility: visible; transform: translate(16px,18px) rotate(0deg) scale(1,1) translate(-16px,-18px); }
  100%    { visibility: visible; transform: translate(16px,18px) rotate(0deg) scale(1,1) translate(-16px,-18px); }
}
@keyframes seerL {
  0%      { visibility: hidden;  transform: translate(5.1px,18px) rotate(0deg) scale(0.001,1) translate(-16px,-18px); }
  53.99%  { visibility: hidden;  transform: translate(5.1px,18px) rotate(0deg) scale(0.001,1) translate(-16px,-18px); }
  54%     { visibility: visible; transform: translate(6.83px,18px) rotate(14.31deg) scale(0.159,1) translate(-16px,-18px); }
  60%     { visibility: visible; transform: translate(8.44px,18px) rotate(12.14deg) scale(0.306,1) translate(-16px,-18px); }
  68%     { visibility: visible; transform: translate(10.86px,18px) rotate(8.56deg) scale(0.528,1) translate(-16px,-18px); }
  76%     { visibility: visible; transform: translate(12.91px,18px) rotate(5.25deg) scale(0.716,1) translate(-16px,-18px); }
  82%     { visibility: visible; transform: translate(14.74px,18px) rotate(2.17deg) scale(0.884,1) translate(-16px,-18px); }
  90%     { visibility: visible; transform: translate(15.89px,18px) rotate(0.19deg) scale(0.990,1) translate(-16px,-18px); }
  93.99%  { visibility: visible; transform: translate(15.89px,18px) rotate(0.19deg) scale(0.990,1) translate(-16px,-18px); }
  94%     { visibility: hidden;  transform: translate(5.1px,18px) rotate(0deg) scale(0.001,1) translate(-16px,-18px); }
  100%    { visibility: hidden;  transform: translate(5.1px,18px) rotate(0deg) scale(0.001,1) translate(-16px,-18px); }
}
@keyframes seerSwA {
  0%      { visibility: hidden;  d: path("${IDLE_SWEEP_LEFT}"); }
  7.99%   { visibility: hidden;  d: path("${IDLE_SWEEP_LEFT}"); }
  8%      { visibility: visible; d: path("M16 2C11.614 7.046 4.088 17.231 1.601 25.376"); }
  16%     { visibility: visible; d: path("M16 2C12.414 7.515 5.847 17.911 4.066 26.369"); }
  25%     { visibility: visible; d: path("M16 2C13.786 8.726 9.466 18.899 8.526 27.705"); }
  33%     { visibility: visible; d: path("M16 2C15.505 10.412 14.541 19.59 14.329 28.464"); }
  41%     { visibility: visible; d: path("M16 2C17.64 9.294 20.866 19.194 21.547 28.073"); }
  47%     { visibility: visible; d: path("M16 2C20.057 7.188 27.224 17.486 29.4 25.784"); }
  47.99%  { visibility: visible; d: path("${IDLE_SWEEP_RIGHT}"); }
  48%     { visibility: hidden;  d: path("${IDLE_SWEEP_RIGHT}"); }
  100%    { visibility: hidden;  d: path("${IDLE_SWEEP_RIGHT}"); }
}
@keyframes seerSwB {
  0%      { visibility: hidden;  d: path("${IDLE_SWEEP_LEFT}"); }
  53.99%  { visibility: hidden;  d: path("${IDLE_SWEEP_LEFT}"); }
  54%     { visibility: visible; d: path("${IDLE_SWEEP_LEFT}"); }
  60%     { visibility: visible; d: path("M16 2C14.134 9.077 10.472 19.094 9.693 27.944"); }
  68%     { visibility: visible; d: path("M16 2C16.295 10.586 16.865 19.625 16.993 28.487"); }
  76%     { visibility: visible; d: path("M16 2C18.059 8.868 22.089 18.974 22.956 27.813"); }
  82%     { visibility: visible; d: path("M16 2C19.466 7.581 25.865 17.983 27.556 26.497"); }
  90%     { visibility: visible; d: path("M16 2C20.349 7.038 27.837 17.233 30.287 25.41"); }
  93%     { visibility: visible; d: path("M16 2C20.349 7.038 27.837 17.233 30.287 25.41"); }
  93.99%  { visibility: visible; d: path("${IDLE_SWEEP_RIGHT}"); }
  94%     { visibility: hidden;  d: path("${IDLE_SWEEP_RIGHT}"); }
  100%    { visibility: hidden;  d: path("${IDLE_SWEEP_RIGHT}"); }
}`;

const ICON_SIZES: Record<string, string> = {
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '72px',
};

export function IconSeer({animation, ...props}: IconSeerProps) {
  const clipId = useId();
  const theme = useTheme();
  const iconProps = useIconDefaults(props);
  const prefersReducedMotion = useReducedMotion();

  if (!prefersReducedMotion && animation === 'loading') {
    return (
      <SvgIcon {...props}>
        <Fragment>
          <style>{`
            @keyframes seerRoll {
              0% { transform: translateX(-1.8px) scaleX(1); }
              46% { transform: translateX(1.8px) scaleX(1); }
              50% { transform: translateX(2px) scaleX(0.001); }
              54% { transform: translateX(-2px) scaleX(0.001); }
              58% { transform: translateX(-1.8px) scaleX(1); }
              100% { transform: translateX(-1.8px) scaleX(1); }
            }
            .eye-loading {
              transform-box: fill-box;
              transform-origin: center;
              animation: seerRoll 4s linear infinite;
            }
          `}</style>
          <path d={bodyPath} />
          <g className="eye-loading">
            <path d={eyePath} />
            <circle cx="8.01857" cy="9" r="2" />
          </g>
        </Fragment>
      </SvgIcon>
    );
  }

  if (!prefersReducedMotion && animation === 'idle') {
    const size = iconProps.legacySize ?? ICON_SIZES[iconProps.size ?? 'md'];
    const fill =
      iconProps.variant === 'warning'
        ? theme.tokens.graphics.warning.vibrant
        : iconProps.variant
          ? theme.tokens.content[
              iconProps.variant === 'muted' ? 'secondary' : iconProps.variant
            ]
          : 'currentColor';

    return (
      <svg
        role="img"
        viewBox="0 0 32 32"
        height={size}
        width={size}
        fill="none"
        stroke={fill}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <style>{idleStyles}</style>
        <defs>
          <clipPath id={clipId}>
            <path d={IDLE_BODY} />
          </clipPath>
        </defs>
        <path d={IDLE_BODY} />
        <g clipPath={`url(#${clipId})`}>
          <g style={{transformBox: 'view-box', animation: 'seerR 2s linear infinite'}}>
            <path d={IDLE_EYE} />
            <circle cx="16" cy="18" r="4" fill={fill} stroke="none" />
          </g>
          <g style={{transformBox: 'view-box', animation: 'seerL 2s linear infinite'}}>
            <path d={IDLE_EYE} />
            <circle cx="16" cy="18" r="4" fill={fill} stroke="none" />
          </g>
        </g>
        <path d={IDLE_SWEEP_LEFT} style={{animation: 'seerSwA 2s linear infinite'}} />
        <path d={IDLE_SWEEP_LEFT} style={{animation: 'seerSwB 2s linear infinite'}} />
      </svg>
    );
  }

  return (
    <SvgIcon {...props}>
      <path d="M8 0.25C8.21 0.25 8.42 0.34 8.56 0.5C9.69 1.78 11.21 3.7 12.61 5.82C13.97 7.88 15.24 10.17 15.91 12.27C15.96 12.34 15.99 12.41 16 12.5C16.08 12.84 15.89 13.2 15.57 13.34C13.38 14.29 11.13 15 8 15C4.87 15 2.61 14.29 0.43 13.35C0.16 13.23 -0.02 12.95 -0.02 12.65C-0.02 12.53 0.02 12.4 0.08 12.3C0.75 10.2 2.03 7.9 3.39 5.83C4.79 3.71 6.31 1.78 7.44 0.5L7.49 0.45C7.63 0.32 7.81 0.25 8 0.25ZM13.65 10.66C12.05 11.19 10.1 11.5 8 11.5C5.9 11.5 3.95 11.19 2.35 10.66C2.1 11.2 1.87 11.73 1.68 12.24C3.53 12.99 5.43 13.5 8 13.5C10.56 13.5 12.47 12.99 14.32 12.24C14.13 11.72 13.9 11.19 13.65 10.66ZM8 5.5C5.92 5.5 4.02 7 3.12 9.33C4.03 9.61 5.08 9.81 6.22 9.92C6.08 9.64 6 9.33 6 9C6 7.9 6.9 7 8 7C9.1 7 10 7.9 10 9C10 9.33 9.92 9.64 9.78 9.92C10.92 9.81 11.96 9.61 12.88 9.33C11.98 7 10.08 5.5 8 5.5ZM8 2.15C7.49 2.76 6.93 3.46 6.35 4.23C6.88 4.08 7.43 4 8 4C8.57 4 9.13 4.08 9.65 4.24C9.07 3.46 8.51 2.76 8 2.15Z" />
    </SvgIcon>
  );
}
