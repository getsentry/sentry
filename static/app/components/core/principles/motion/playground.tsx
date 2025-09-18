import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {motion, type BezierDefinition, type HTMLMotionProps} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex, Grid, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import * as Storybook from 'sentry/stories';

const durations = {
  xs: 0.06,
  sm: 0.11,
  md: 0.16,
  lg: 0.24,
  xl: 0.32,
  '2xl': 0.48,
  '3xl': 0.64,
};
const easings: Record<'enter' | 'exit' | 'default' | 'snap', BezierDefinition> = {
  enter: [0.24, 1, 0.32, 1],
  exit: [0.64, 0, 0.8, 0],
  default: [0.72, 0, 0.16, 1],
  snap: [0.8, -0.4, 0.5, 1],
};
const animations = ['x', 'y', 'scale', 'rotate'] as const;

export function MotionPlayground() {
  const [animation, setAnimation] = useState<(typeof animations)[number]>('x');
  const [duration, setDuration] = useState<keyof typeof durations>('md');
  const [easing, setEasing] = useState<keyof typeof easings>('default');

  const boxProps = useMemo(
    () => createAnimation({duration, easing, property: animation}),
    [duration, easing, animation]
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
        <Grid columns={'repeat(2, 160px) 1fr'} gap="md" align="center" justify="center">
          <Control label="Duration">
            <CompactSelect
              options={extractTokens(durations).map(value => ({value, label: value}))}
              value={duration}
              onChange={opt => setDuration(opt.value)}
            />
          </Control>
          <Control label="Easing">
            <CompactSelect
              options={extractTokens(easings).map(value => ({value, label: value}))}
              value={easing}
              onChange={opt => setEasing(opt.value)}
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
  duration: keyof typeof durations;
  easing: keyof typeof easings;
  property: (typeof animations)[number];
}
function createAnimation({
  property,
  duration: durationKey,
  easing,
}: CreateAnimationOptions): HTMLMotionProps<'div'> {
  const delay = 1;
  const duration = durations[durationKey];
  const ease = easings[easing];
  const defaultState = {x: 0, y: 0, opacity: 1, scale: 1, rotate: 0};

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
type Easing = keyof typeof easings;
type State = 'start' | 'end';
type TargetConfig = Record<Easing, Record<State, number>>;

interface TargetStateOptions {
  easing: keyof typeof easings;
  property: Property;
  state: State;
}

const TARGET_OPACITY: TargetConfig = {
  default: {start: 1, end: 1},
  snap: {start: 1, end: 1},
  enter: {start: 0, end: 1},
  exit: {start: 1, end: 0},
};
const TARGET_AXIS: TargetConfig = {
  default: {start: -32, end: 32},
  snap: {start: -32, end: 32},
  enter: {start: -32, end: 0},
  exit: {start: 0, end: 32},
};
const TARGET_CONFIGS: Record<string, TargetConfig> = {
  rotate: {
    default: {start: 0, end: 90},
    snap: {start: 0, end: 90},
    enter: {start: -90, end: 0},
    exit: {start: 0, end: 90},
  },
  scale: {
    default: {start: 1, end: 1.2},
    snap: {start: 1, end: 1.2},
    enter: {start: 1.2, end: 1},
    exit: {start: 1, end: 0.8},
  },
  x: TARGET_AXIS,
  y: TARGET_AXIS,
};

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
