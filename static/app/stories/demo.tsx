import {useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ContainerBreakpointSize} from 'sentry/utils/theme';
import {useDimensions} from 'sentry/utils/useDimensions';

import {ResizableWindow} from './resizableWindow';

interface DemoProps extends FlexProps {
  resizable?: boolean;
}

export function Demo({resizable, ...props}: DemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions({elementRef: containerRef});
  const breakpoints = useContainerBreakpoints();

  if (!resizable) {
    return (
      <Container
        containerType="inline-size"
        marginTop="md"
        style={{marginBottom: '-1lh'}}
      >
        <Flex
          data-test-id="storybook-demo"
          width="100%"
          align="center"
          justify="center"
          gap="md"
          padding="3xl xl"
          background="secondary"
          borderTop="primary"
          borderLeft="primary"
          borderRight="primary"
          radius="md md 0 0"
          minHeight="160px"
          overflow="auto"
          maxHeight="512px"
          {...props}
        />
      </Container>
    );
  }

  // -1lh collapses the gap between the demo chrome and the next content block
  return (
    <DemoChrome marginTop="md" position="relative" style={{marginBottom: '-1lh'}}>
      <Ruler containerRef={containerRef} breakpoints={breakpoints} />
      <Flex
        align="center"
        justify="center"
        position="absolute"
        left="0"
        right="0"
        bottom="16px"
        gap="sm"
      >
        <Container display="inline-block" width="4ch">
          <Text align="right">{getActiveBreakpoint(breakpoints, dimensions.width)}</Text>
        </Container>
        <Text variant="muted" tabular>
          ({Math.round(dimensions.width)}px)
        </Text>
        <Text monospace variant="muted">
          ×
        </Text>
        <Container display="inline-block" width="4ch">
          <Text align="right">{getActiveBreakpoint(breakpoints, dimensions.height)}</Text>
        </Container>
        <Text variant="muted" tabular>
          ({Math.round(dimensions.height)}px)
        </Text>
      </Flex>
      <Flex align="center" justify="center" padding="xl">
        <ResizableWindow ref={containerRef}>
          <Flex
            flex="1"
            data-test-id="storybook-demo"
            width="100%"
            align="center"
            justify="center"
            gap="md"
            padding="xl"
            radius="0"
            overflow="auto"
            {...props}
          />
        </ResizableWindow>
      </Flex>
    </DemoChrome>
  );
}

function useContainerBreakpoints(): Array<[ContainerBreakpointSize, number]> {
  const theme = useTheme();
  return useMemo(
    () =>
      (Object.entries(theme.container) as Array<[ContainerBreakpointSize, string]>)
        .map(
          ([key, value]) =>
            [key, parseInt(value, 10)] as [ContainerBreakpointSize, number]
        )
        .filter(([key, px]) => key !== 'zero' && px > 0)
        .sort((a, b) => a[1] - b[1]),
    [theme.container]
  );
}

function getActiveBreakpoint(
  breakpoints: Array<[ContainerBreakpointSize, number]>,
  size: number
): ContainerBreakpointSize {
  for (let i = breakpoints.length - 1; i >= 0; i--) {
    const bp = breakpoints[i];
    if (bp && size >= bp[1]) {
      return bp[0];
    }
  }
  return 'zero';
}

function Ruler({
  containerRef,
  breakpoints,
}: {
  breakpoints: Array<[ContainerBreakpointSize, number]>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const snapTo = (px: number) => {
    const el = containerRef.current;
    if (el) {
      const bordersWidth = el.offsetWidth - el.clientWidth;
      el.style.width = `${px + bordersWidth}px`;
    }
  };

  return (
    <Container
      position="relative"
      background="secondary"
      borderBottom="primary"
      overflow="hidden"
      style={{height: 28, zIndex: 1}}
    >
      {breakpoints.map(([name, px], i) => (
        <TickButton
          key={name}
          type="button"
          onClick={() => snapTo(px)}
          style={{width: px, zIndex: breakpoints.length - 1 - i}}
          data-breakpoint={name}
        />
      ))}
    </Container>
  );
}

const TickButton = styled('button')`
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: translateX(-50%);
  left: 50%;
  padding: 0;
  border: none;
  border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  border-top-color: transparent;
  border-bottom-color: transparent;
  background: ${p => p.theme.tokens.interactive.transparent.neutral.background.rest};
  cursor: pointer;
  color: ${p => p.theme.tokens.content.secondary};

  &::before {
    content: attr(data-breakpoint);
    font-family: ${p => p.theme.font.family.mono};
    color: currentColor;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    padding-bottom: 2px;
    opacity: 0;
    transition: opacity 100ms;
  }
  &:hover {
    border-color: ${p => p.theme.tokens.border.transparent.accent.vibrant};
    background:
      linear-gradient(
        ${p => p.theme.tokens.interactive.transparent.accent.background.hover},
        ${p => p.theme.tokens.interactive.transparent.accent.background.hover}
      ),
      ${p => p.theme.tokens.background.tertiary};
    border-radius: ${p => p.theme.radius['2xs']};
    color: ${p => p.theme.tokens.content.accent};
    &::before {
      opacity: 1;
    }
  }
  &:active {
    background: ${p => p.theme.tokens.interactive.transparent.accent.background.active};
  }
`;

const DemoChrome = styled(Container)`
  overflow: hidden;
  background: ${p => p.theme.tokens.background.tertiary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  padding-bottom: ${p => p.theme.space['3xl']};

  /* Hide borders on ticks before the hovered one (previous siblings via :has) */
  ${TickButton}:has(~ ${TickButton}:hover) {
    border-color: transparent;
  }
`;
