import {useRef} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ResizableWindow, useElementSize} from './resizableWindow';

interface DemoProps extends FlexProps {
  resizable?: boolean;
}

export function Demo({resizable, ...props}: DemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useElementSize(containerRef);

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

  return (
    <DemoChrome marginTop="md" position="relative" style={{marginBottom: '-1lh'}}>
      <Ruler containerRef={containerRef} />
      <Flex
        align="center"
        justify="center"
        position="absolute"
        left="0"
        right="0"
        bottom="16px"
        gap="sm"
      >
        <Text display="inline-block" style={{width: '3ch'}} align="right">
          {getActiveBreakpoint(width.width)}
        </Text>{' '}
        <Text variant="muted" tabular>
          ({Math.round(width.width)}px)
        </Text>
        <Text monospace variant="muted">
          {' × '}
        </Text>
        <Text display="inline-block" style={{width: '3ch'}} align="right">
          {getActiveBreakpoint(width.height)}
        </Text>{' '}
        <Text variant="muted" tabular>
          ({Math.round(width.height)}px)
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

const CONTAINER_BREAKPOINTS: Array<[string, number]> = [
  ['3xs', 320],
  ['2xs', 384],
  ['xs', 448],
  ['sm', 512],
  ['md', 576],
  ['lg', 640],
  ['xl', 768],
  ['2xl', 896],
  ['3xl', 1024],
  ['4xl', 1152],
  ['5xl', 1280],
];

function getActiveBreakpoint(width: number): string {
  for (let i = CONTAINER_BREAKPOINTS.length - 1; i >= 0; i--) {
    if (width >= CONTAINER_BREAKPOINTS[i]![1]) {
      return CONTAINER_BREAKPOINTS[i]![0];
    }
  }
  return 'zero';
}

function Ruler({containerRef}: {containerRef: React.RefObject<HTMLDivElement | null>}) {
  const snapTo = (px: number) => {
    const el = containerRef.current;
    if (el) {
      el.style.width = `${px + 2}px`;
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
      {CONTAINER_BREAKPOINTS.map(([name, px], i) => (
        <TickButton
          key={name}
          type="button"
          onClick={() => snapTo(px)}
          style={{width: px, zIndex: 10 - i}}
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
