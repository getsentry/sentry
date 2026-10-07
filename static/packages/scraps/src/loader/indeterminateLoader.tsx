import {useRef, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';
import * as stylex from '@stylexjs/stylex';

import {border} from '@sentry/scraps/theme/tokens.stylex';

interface IndeterminateLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'vibrant' | 'monochrome';
}

const SQUIGGLE_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E\")";

const indeterminateSlow = stylex.keyframes({
  '0%': {left: '-35%', right: '100%'},
  '60%': {left: '100%', right: '-90%'},
  '100%': {left: '100%', right: '-90%'},
});

const indeterminateFast = stylex.keyframes({
  '0%': {left: '-200%', right: '100%'},
  '60%': {left: '107%', right: '-8%'},
  '100%': {left: '107%', right: '-8%'},
});

const squiggleMask = {
  maskImage: SQUIGGLE_TILE,
  maskRepeat: 'repeat-x',
  maskSize: '16px 8px',
  WebkitMaskImage: SQUIGGLE_TILE,
  WebkitMaskRepeat: 'repeat-x',
  WebkitMaskSize: '16px 8px',
} as const;

const styles = stylex.create({
  track: {
    position: 'relative',
    overflow: 'hidden',
    width: stylex.firstThatWorks('calc(round(down, 100% - 16px, 8px) + 16px)', '100%'),
    height: '8px',
    '::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      ...squiggleMask,
    },
  },
  trackVibrant: {
    '::before': {backgroundColor: border.secondary, opacity: 1},
  },
  trackMonochrome: {
    '::before': {backgroundColor: 'currentColor', opacity: 0.2},
  },
  colorMask: {
    position: 'absolute',
    inset: 0,
    ...squiggleMask,
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    animationTimingFunction: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    animationIterationCount: 'infinite',
    animationFillMode: 'backwards',
  },
  barVibrant: {backgroundColor: border.accentVibrant},
  barMonochrome: {backgroundColor: 'currentColor'},
  slow: {animationName: indeterminateSlow},
  fast: {animationName: indeterminateFast},
  timing: (duration: string, delay: string) => ({
    animationDuration: duration,
    animationDelay: delay,
  }),
});

// Lerp animation timing based on track width.
// Small (~128px): 2.0s duration, 1.0s delay
// Large (~400px+): 3.2s duration, 1.6s delay
const WIDTH = {MIN: 128, MAX: 400};
const DURATION = {MIN: 2, MAX: 2.8};
const DELAY = {MIN: 0.8, MAX: 1.2};

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.min(1, Math.max(0, t));
}

function useAnimationTiming() {
  const ref = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(DURATION.MAX);
  const [delay, setDelay] = useState(DELAY.MAX);

  useResizeObserver({
    ref,
    onResize() {
      const w = ref.current?.offsetWidth ?? WIDTH.MAX;
      const t = (w - WIDTH.MIN) / (WIDTH.MAX - WIDTH.MIN);
      setDuration(lerp(DURATION.MIN, DURATION.MAX, t));
      setDelay(lerp(DELAY.MIN, DELAY.MAX, t));
    },
  });

  return {ref, duration, delay};
}

export function IndeterminateLoader({
  variant = 'vibrant',
  className,
  style,
  ...props
}: IndeterminateLoaderProps) {
  const {ref, duration, delay} = useAnimationTiming();
  const isMonochrome = variant === 'monochrome';
  const barColor = isMonochrome ? styles.barMonochrome : styles.barVibrant;
  const sx = stylex.props(
    styles.track,
    isMonochrome ? styles.trackMonochrome : styles.trackVibrant
  );

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label="Loading"
      {...props}
      className={className ? `${sx.className} ${className}` : sx.className}
      style={sx.style ? {...sx.style, ...style} : style}
    >
      <span {...stylex.props(styles.colorMask)}>
        <span
          {...stylex.props(
            styles.bar,
            barColor,
            styles.slow,
            styles.timing(`${duration}s`, '0s')
          )}
        />
        <span
          {...stylex.props(
            styles.bar,
            barColor,
            styles.fast,
            styles.timing(`${duration}s`, `${delay}s`)
          )}
        />
      </span>
    </div>
  );
}
