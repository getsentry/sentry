import {useEffect, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';
import {AnimatePresence, motion} from 'framer-motion';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {testableTransition} from 'sentry/utils/testableTransition';

interface IndeterminateLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  messages?: React.ReactNode[];
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
// Small (~128px): 2.0s duration, 1.0s delay
// Large (~400px+): 3.2s duration, 1.6s delay
const WIDTH = {MIN: 128, MAX: 400};
const DURATION = {MIN: 2.0, MAX: 2.8};
const DELAY = {MIN: 0.8, MAX: 1.2};

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.min(1, Math.max(0, t));
}

function useAnimationTiming() {
  const ref = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(DURATION.MAX);
  const [delay, setDelay] = useState(DURATION.MAX);

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

const MESSAGE_INTERVAL_MS = 10_000;

function useMessageCycler(messages: React.ReactNode[]) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1 || index >= messages.length - 1) {
      return undefined;
    }
    const timer = setTimeout(() => setIndex(i => i + 1), MESSAGE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [index, messages.length]);

  return {message: messages.length > 0 ? messages[index] : null, index};
}

export function IndeterminateLoader({
  variant = 'vibrant',
  messages,
  ...props
}: IndeterminateLoaderProps) {
  const theme = useTheme();
  const {ref, duration, delay} = useAnimationTiming();
  const {message: currentMessage, index: messageIndex} = useMessageCycler(messages ?? []);

  const track = (
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
          timing="cubic-bezier(0.4, 0.0, 0.2, 1)"
          duration={`${duration}s`}
          delay="0s"
        />
        <Bar
          color={
            variant === 'monochrome' ? 'currentColor' : theme.tokens.border.accent.vibrant
          }
          animation={indeterminateFast}
          timing="cubic-bezier(0.4, 0.0, 0.2, 1)"
          duration={`${duration}s`}
          delay={`${delay}s`}
        />
      </ColorMask>
    </Track>
  );

  if (!messages?.length) {
    return track;
  }

  return (
    <Stack align="start" gap="xl" width="100%" maxWidth="72ch">
      {track}
      <AnimatePresence mode="wait">
        <motion.div
          key={messageIndex}
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={testableTransition({duration: 0.3})}
        >
          <Text monospace variant="muted" size="lg">
            {currentMessage}
            <Ellipsis />
          </Text>
        </motion.div>
      </AnimatePresence>
    </Stack>
  );
}

const dotFadeInOut = keyframes`
  0%, 30% { opacity: 0; }
  40%, 70% { opacity: 1; }
  80%, 100% { opacity: 0; }
`;

function Ellipsis() {
  return (
    <span aria-hidden>
      <Dot delay={0}>.</Dot>
      <Dot delay={0.2}>.</Dot>
      <Dot delay={0.4}>.</Dot>
    </span>
  );
}

const Dot = styled('span')<{delay: number}>`
  opacity: 0;
  animation: ${dotFadeInOut} 2.5s ${p => p.delay}s infinite;
`;

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
