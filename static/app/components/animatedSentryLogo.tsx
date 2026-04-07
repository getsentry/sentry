import {useId} from 'react';
import {useTheme} from '@emotion/react';

interface AnimatedSentryLogoProps {
  /**
   * Draw progress from 0 (no stroke) to 1 (fully drawn).
   * Uses stroke-dashoffset on the Sentry glyph outline.
   */
  progress: number;
  className?: string;
  size?: number;
}

// Single-path Sentry glyph (64×59 viewBox)
const SENTRY_GLYPH =
  'M31.9948 0C33.0411 0 34.0698 0.28309 34.9701 0.816074C35.8698 1.34902 36.6108 2.11326 37.1138 3.03002L63.1813 49.4916C63.7108 50.4167 63.9896 51.4634 63.9896 52.5294C63.9896 53.3288 63.8344 54.1179 63.5327 54.8527L63.2243 55.6492C62.7224 56.5678 61.9805 57.3325 61.0806 57.8671C60.1803 58.4016 59.1523 58.6861 58.1053 58.687H51.9867V53.611H58.1053C58.275 53.6124 58.4421 53.5664 58.5894 53.4821C58.7365 53.398 58.8599 53.2774 58.9448 53.1307C59.0363 52.9806 59.0851 52.8068 59.0853 52.6309C59.0853 52.4551 59.0361 52.2814 58.9448 52.1311L32.8733 5.63052C32.7904 5.48053 32.6696 5.35444 32.5219 5.26739C32.3743 5.18042 32.2052 5.13463 32.0338 5.13463C31.8633 5.1349 31.6967 5.18091 31.5497 5.26739C31.402 5.35444 31.2773 5.48053 31.1943 5.63052L25.1968 16.3059C31.3083 20.4099 36.3755 25.887 39.9915 32.2994C44.0222 39.5769 46.1174 47.7675 46.0711 56.0865V58.4879H30.3158V55.9694C30.3478 50.489 28.9706 45.0915 26.3174 40.2961C24.0788 36.3061 20.9951 32.8521 17.282 30.1791L14.3223 35.4582C17.1667 37.6052 19.5265 40.331 21.2414 43.455C23.3822 47.3214 24.5081 51.667 24.5174 56.0865V58.609H5.92727C4.88044 58.6081 3.85214 58.3233 2.95192 57.789C2.05148 57.2543 1.31035 56.4862 0.808265 55.5672C0.278995 54.6422 0 53.5952 0 52.5294C1.59391e-05 51.4636 0.27896 50.4166 0.808265 49.4916L4.56845 42.7717C6.13984 43.3348 7.58937 44.1931 8.84406 45.2941L5.08777 52.0101C4.99593 52.1606 4.94721 52.3335 4.94721 52.5099C4.94727 52.6861 4.996 52.8592 5.08777 53.0097C5.17546 53.1534 5.29701 53.2735 5.4431 53.3572C5.58995 53.4411 5.75816 53.4875 5.92727 53.4899H19.4413C19.0534 50.4366 17.9811 47.5091 16.3059 44.927C14.6307 42.345 12.3957 40.1727 9.76556 38.5741L7.64533 37.2973L15.521 23.303L17.6413 24.5408C23.0555 27.7797 27.524 32.3846 30.5969 37.8947C33.2819 42.6981 34.8667 48.0386 35.2357 53.529H41.1512C40.7642 46.9702 38.8906 40.5854 35.673 34.8569C32.1062 28.4358 26.9071 23.071 20.601 19.3046L18.4417 18.0239L26.8758 3.03002C27.3791 2.11272 28.123 1.34906 29.0233 0.816074C29.9234 0.283345 30.9489 0.000109961 31.9948 0Z';

/**
 * Sentry brand mark with stroke-draw progress. The outline draws
 * itself via stroke-dashoffset, driven by a `progress` prop (0-1).
 */
export function AnimatedSentryLogo({
  progress,
  size = 72,
  className,
}: AnimatedSentryLogoProps) {
  const theme = useTheme();
  const clipId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 59"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Sentry"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={SENTRY_GLYPH} />
        </clipPath>
      </defs>

      {/* Muted base shape */}
      <path fill={theme.tokens.background.secondary} d={SENTRY_GLYPH} />

      {/* Stroke-draw overlay, clipped to the glyph shape */}
      <path
        d={SENTRY_GLYPH}
        clipPath={`url(#${clipId})`}
        pathLength={1}
        stroke={theme.tokens.content.accent}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
        style={{transition: 'stroke-dashoffset 600ms ease-out'}}
      />
    </svg>
  );
}
