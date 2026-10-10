import {useRef, useState} from 'react';
import {css, cx, type LinariaClassName} from '@linaria/core';
import {useResizeObserver} from '@react-aria/utils';

interface IndeterminateLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Emotion css is not supported; use an Emotion styled wrapper. */
  css?: never;
  /** Custom styles from Linaria css; Emotion styles are not supported. */
  customCss?: LinariaClassName;
  variant?: 'vibrant' | 'monochrome';
}

const styles = {
  track: css`
    position: relative;
    overflow: hidden;
    width: 100%;
    width: calc(round(down, 100% - 16px, 8px) + 16px);
    height: 8px;
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E");
      mask-repeat: repeat-x;
      mask-size: 16px 8px;
      -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E");
      -webkit-mask-repeat: repeat-x;
      -webkit-mask-size: 16px 8px;
    }
  `,
  trackVibrant: css`
    &::before {
      background-color: var(--ln-border-secondary, #e6e6e9);
      opacity: 1;
    }
  `,
  trackMonochrome: css`
    &::before {
      background-color: currentColor;
      opacity: 0.2;
    }
  `,
  colorMask: css`
    position: absolute;
    inset: 0;
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E");
    mask-repeat: repeat-x;
    mask-size: 16px 8px;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E");
    -webkit-mask-repeat: repeat-x;
    -webkit-mask-size: 16px 8px;
  `,
  bar: css`
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    animation-iteration-count: infinite;
    animation-fill-mode: backwards;
  `,
  barVibrant: css`
    background-color: var(--ln-border-accentVibrant, #7553ff);
  `,
  barMonochrome: css`
    background-color: currentColor;
  `,
  slow: css`
    animation-name: ln-loader-animation-0;
    @keyframes ln-loader-animation-0 {
      0% {
        left: -35%;
        right: 100%;
      }
      60% {
        left: 100%;
        right: -90%;
      }
      100% {
        left: 100%;
        right: -90%;
      }
    }
  `,
  fast: css`
    animation-name: ln-loader-animation-1;
    @keyframes ln-loader-animation-1 {
      0% {
        left: -200%;
        right: 100%;
      }
      60% {
        left: 107%;
        right: -8%;
      }
      100% {
        left: 107%;
        right: -8%;
      }
    }
  `,
  timing: css`
    animation-duration: var(--ln-loader-duration);
    animation-delay: var(--ln-loader-delay);
  `,
};

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
  customCss,
  className,
  style,
  ...props
}: IndeterminateLoaderProps) {
  const {ref, duration, delay} = useAnimationTiming();
  const isMonochrome = variant === 'monochrome';
  const barColor = isMonochrome ? styles.barMonochrome : styles.barVibrant;
  const sx = {
    className: cx(
      styles.track,
      isMonochrome ? styles.trackMonochrome : styles.trackVibrant
    ),
  };

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label="Loading"
      {...props}
      className={cx(sx.className, customCss, className)}
      style={style}
    >
      <span {...{className: cx(styles.colorMask)}}>
        <span
          {...{className: cx(styles.bar, barColor, styles.slow, styles.timing)}}
          style={
            {
              '--ln-loader-duration': `${duration}s`,
              '--ln-loader-delay': '0s',
            } as React.CSSProperties
          }
        />
        <span
          {...{className: cx(styles.bar, barColor, styles.fast, styles.timing)}}
          style={
            {
              '--ln-loader-duration': `${duration}s`,
              '--ln-loader-delay': `${delay}s`,
            } as React.CSSProperties
          }
        />
      </span>
    </div>
  );
}
