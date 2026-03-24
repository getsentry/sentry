import {useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

export interface IndeterminateLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'vibrant' | 'monochrome';
}

const SQUIGGLE_TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='1 0 16 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M17 6c-4 0-4-4-8-4S5 6 1 6'/%3E%3C/svg%3E")`;

const indeterminateSlow = keyframes`
  0% { left: -35%; right: 100%; }
  60% { left: 100%; right: -90%; }
  100% { left: 100%; right: -90%; }
`;

const indeterminateFast = keyframes`
  0% { left: -200%; right: 100%; }
  60% { left: 107%; right: -8%; }
  100% { left: 107%; right: -8%; }
`;

// Lerp animation timing based on track width.
// Small (~100px): 0.6s duration, 0.3s delay
// Large (~400px+): 2.1s duration, 1.15s delay
const MIN_WIDTH = 128;
const MAX_WIDTH = 400;

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.min(1, Math.max(0, t));
}

function useAnimationTiming() {
  const ref = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(2.1);
  const [delay, setDelay] = useState(1.15);

  useResizeObserver({
    ref,
    onResize() {
      const w = ref.current?.offsetWidth ?? MAX_WIDTH;
      const t = (w - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH);
      setDuration(lerp(1.3, 2.1, t));
      setDelay(lerp(0.65, 1.15, t));
    },
  });

  return {ref, duration, delay};
}

export function IndeterminateLoader({
  variant = 'vibrant',
  ...props
}: IndeterminateLoaderProps) {
  const theme = useTheme();
  const {ref, duration, delay} = useAnimationTiming();

  return (
    <Track
      ref={ref}
      role="progressbar"
      aria-label="Loading"
      opacity={variant === 'monochrome' ? '0.2' : '1'}
      color={variant === 'monochrome' ? 'currentColor' : theme.tokens.border.secondary}
      {...props}
    >
      <ColorMask>
        <Bar
          color={
            variant === 'monochrome' ? 'currentColor' : theme.tokens.border.accent.vibrant
          }
          animation={indeterminateSlow}
          timing="cubic-bezier(0.65, 0.815, 0.735, 0.395)"
          duration={`${duration}s`}
          delay="0s"
        />
        <Bar
          color={
            variant === 'monochrome' ? 'currentColor' : theme.tokens.border.accent.vibrant
          }
          animation={indeterminateFast}
          timing="cubic-bezier(0.165, 0.84, 0.44, 1)"
          duration={`${duration}s`}
          delay={`${delay}s`}
        />
      </ColorMask>
    </Track>
  );
}

const Track = styled('div')<{color: string; opacity: string}>`
  position: relative;
  overflow: hidden;
  width: 100%;
  width: calc(round(down, 100% - 16px, 8px) + 16px);
  height: 8px;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: ${p => p.color};
    opacity: ${p => p.opacity};
    mask-image: ${SQUIGGLE_TILE};
    mask-repeat: repeat-x;
    mask-size: 16px 8px;
    -webkit-mask-image: ${SQUIGGLE_TILE};
    -webkit-mask-repeat: repeat-x;
    -webkit-mask-size: 16px 8px;
  }
`;

const ColorMask = styled('span')`
  position: absolute;
  inset: 0;
  mask-image: ${SQUIGGLE_TILE};
  mask-repeat: repeat-x;
  mask-size: 16px 8px;
  -webkit-mask-image: ${SQUIGGLE_TILE};
  -webkit-mask-repeat: repeat-x;
  -webkit-mask-size: 16px 8px;
`;

const Bar = styled('span')<{
  animation: ReturnType<typeof keyframes>;
  color: string;
  delay: string;
  duration: string;
  timing: string;
}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${p => p.color};
  animation: ${p => p.animation} ${p => p.duration} ${p => p.timing} ${p => p.delay}
    infinite backwards;
`;
