import {useMemo, useState} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, type HTMLMotionProps} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex, Grid, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import * as Storybook from 'sentry/stories';

type Motion = Theme['motion'];
type Duration = keyof Motion['enter'];
type Easing = keyof Motion;

const animations = ['x', 'y', 'scale', 'rotate'] as const;

export function MotionPlayground() {
  const {motion: tokens} = useTheme();
  const [animation, setAnimation] = useState<(typeof animations)[number]>('x');
  const [duration, setDuration] = useState<Duration>('moderate');
  const [easing, setEasing] = useState<Easing>('smooth');

  const boxProps = useMemo(
    () => createAnimation({duration, easing, property: animation, tokens}),
    [duration, easing, animation, tokens]
  );

  return (
    <Stack>
      <Storybook.Demo>
        <Box key={`animate-${animation}:${duration}:${easing}`} {...boxProps} />
      </Storybook.Demo>
      <Flex
        width="100%"
        wrap="wrap"
        background="tertiary"
        border="primary"
        padding="xl 2xl"
        radius="0 0 xl xl"
        gap="xl"
      >
        <Grid columns="160px 192px" gap="lg" align="center" justify="center">
          <Control label="Easing">
            <CompactSelect
              options={extractTokens(tokens).map(value => ({value, label: value}))}
              value={easing}
              onChange={opt => setEasing(opt.value)}
            />
          </Control>
          <Control label="Duration">
            <CompactSelect
              options={extractTokens(tokens.enter).map(value => ({value, label: value}))}
              value={duration}
              onChange={opt => setDuration(opt.value)}
            />
          </Control>
        </Grid>
        <Control label="Animation">
          <ButtonBar merged gap="0">
            {animations.map(value => (
              <Button
                key={value}
                priority={animation === value ? 'primary' : undefined}
                onClick={() => setAnimation(value)}
              >
                {value}
              </Button>
            ))}
          </ButtonBar>
        </Control>
      </Flex>
    </Stack>
  );
}

const Box = styled(motion.div)`
  display: block;
  width: 128px;
  height: 128px;
  background: ${p => p.theme.tokens.border.accent};
  border: 1px solid ${p => p.theme.tokens.border.accent};
  border-radius: ${p => p.theme.borderRadius};
`;

function Control({label, children}: React.PropsWithChildren<{label: string}>) {
  return (
    <Flex align="center" justify="start" gap="md">
      {props => (
        <label {...props}>
          <Text size="lg">{label}</Text>
          {children}
        </label>
      )}
    </Flex>
  );
}

interface CreateAnimationOptions {
  duration: Duration;
  easing: Easing;
  property: (typeof animations)[number];
  tokens: Motion;
}
function createAnimation({
  property,
  duration: durationKey,
  easing,
  tokens,
}: CreateAnimationOptions): HTMLMotionProps<'div'> {
  const delay = 1;
  const defaultState = {x: 0, y: 0, opacity: 1, scale: 1, rotate: 0};
  const {duration, ease} = extractDurationAndEase(tokens[easing][durationKey]);

  return {
    initial: {
      ...defaultState,
      ...makeTargetState({property, state: 'start', easing}),
    },
    animate: {
      ...defaultState,
      ...makeTargetState({property, state: 'end', easing}),
    },
    transition: {
      ease,
      duration,
      delay,
      repeat: Infinity,
      repeatDelay: delay,
      repeatType: ['enter', 'exit'].includes(easing)
        ? 'mirror'
        : property === 'rotate'
          ? 'loop'
          : 'reverse',
    },
  };
}

type Property = (typeof animations)[number];
type State = 'start' | 'end';
type TargetConfig = Record<Easing, Record<State, number>>;

interface TargetStateOptions {
  easing: Easing;
  property: Property;
  state: State;
}

const TARGET_OPACITY: TargetConfig = {
  smooth: {start: 1, end: 1},
  snap: {start: 1, end: 1},
  enter: {start: 0, end: 1},
  exit: {start: 1, end: 0},
};
const TARGET_AXIS: TargetConfig = {
  smooth: {start: -16, end: 16},
  snap: {start: -16, end: 16},
  enter: {start: -16, end: 0},
  exit: {start: 0, end: 16},
};
const TARGET_CONFIGS: Record<string, TargetConfig> = {
  rotate: {
    smooth: {start: 0, end: 90},
    snap: {start: 0, end: 90},
    enter: {start: -90, end: 0},
    exit: {start: 0, end: 90},
  },
  scale: {
    smooth: {start: 1, end: 1.125},
    snap: {start: 1, end: 1.125},
    enter: {start: 1.125, end: 1},
    exit: {start: 1, end: 0.8},
  },
  x: TARGET_AXIS,
  y: TARGET_AXIS,
};

function extractDurationAndEase(css: string): {
  duration: number;
  ease: [number, number, number, number];
} {
  const re =
    /^\s*(\d*\.?\d+)(ms|s)\s+cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)\s*$/i;
  const match = css.match(re);

  if (!match) {
    throw new Error(`Invalid timing string: ${css}`);
  }

  const [, value, unit, x1, y1, x2, y2] = match as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  // framer-motion expects duration in seconds
  const duration =
    unit.toLowerCase() === 'ms'
      ? Number.parseFloat(value) / 1000
      : Number.parseFloat(value);

  const ease: [number, number, number, number] = [
    Number.parseFloat(x1),
    Number.parseFloat(y1),
    Number.parseFloat(x2),
    Number.parseFloat(y2),
  ];

  return {duration, ease};
}

function makeTargetState({property, state, easing}: TargetStateOptions) {
  const config = TARGET_CONFIGS[property as keyof typeof TARGET_CONFIGS] ?? TARGET_AXIS;
  return {
    [property]: config[easing][state],
    opacity: TARGET_OPACITY[easing][state],
  };
}

function extractTokens<T extends Record<string, any>>(obj: T) {
  return Object.keys(obj) as Array<keyof T>;
}
