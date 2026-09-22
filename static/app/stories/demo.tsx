import {Fragment, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import screenfull from 'screenfull';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, type FlexProps} from '@sentry/scraps/layout';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Text} from '@sentry/scraps/text';

import {IconContract, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ContainerBreakpointSize} from 'sentry/utils/theme';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useFullscreen} from 'sentry/utils/window/useFullscreen';
import {useIsFullscreen} from 'sentry/utils/window/useIsFullscreen';

import {allowOpenOverlayOverflowCss, ResizableWindow} from './resizableWindow';

interface DemoProps extends FlexProps {
  resizable?: boolean;
  /**
   * Closes the demo into a box of its own, for the callers that do not put a
   * code block under it. The default leaves the bottom open and pulls the next
   * block up to meet it.
   */
  standalone?: boolean;
}

interface HeadingBreadcrumb {
  label: string;
  to: string;
}

type ContainerBreakpoint = [name: ContainerBreakpointSize, px: number];

interface DemoSize {
  height: number;
  width: number;
}

export function Demo({resizable, standalone, ...props}: DemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions({elementRef: containerRef});
  const breakpoints = useContainerBreakpoints();
  const {toggle: toggleFullscreen} = useFullscreen({elementRef: fullscreenRef});
  const isFullscreen = useIsFullscreen();
  const [breadcrumb, setBreadcrumb] = useState<HeadingBreadcrumb[]>([]);

  if (!resizable) {
    return (
      <Container
        containerType="inline-size"
        marginTop={standalone ? undefined : 'md'}
        style={standalone ? undefined : {marginBottom: '-1lh'}}
      >
        <Flex
          css={allowOpenOverlayOverflowCss}
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
          borderBottom={standalone ? 'primary' : undefined}
          radius={standalone ? 'md' : 'md md 0 0'}
          minHeight="160px"
          overflow="auto"
          maxHeight="512px"
          {...props}
        />
      </Container>
    );
  }

  const handleFullscreenToggle = () => {
    if (!isFullscreen) {
      setBreadcrumb(getHeadingBreadcrumb(fullscreenRef.current));
    }
    toggleFullscreen();
  };

  // -1lh collapses the gap between the demo chrome and the next content block
  return (
    <RevealOnHover>
      {revealProps => (
        <DemoChrome
          {...revealProps}
          ref={fullscreenRef}
          marginTop={isFullscreen ? '0' : 'md'}
          position="relative"
          style={{
            marginBottom: isFullscreen ? 0 : '-1lh',
          }}
        >
          <Container background="secondary" borderBottom="primary">
            <DemoToolbar
              breadcrumb={isFullscreen ? breadcrumb : []}
              breakpoints={breakpoints}
              dimensions={dimensions}
              isFullscreen={isFullscreen}
              onFullscreenToggle={handleFullscreenToggle}
            />
            <Ruler containerRef={containerRef} breakpoints={breakpoints} />
          </Container>
          <Flex align="center" justify="center" flex="1" minHeight="0" padding="xl">
            <ResizableWindow ref={containerRef}>
              <Flex
                css={allowOpenOverlayOverflowCss}
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
      )}
    </RevealOnHover>
  );
}

interface DemoToolbarProps {
  breadcrumb: HeadingBreadcrumb[];
  breakpoints: ContainerBreakpoint[];
  dimensions: DemoSize;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
}

function DemoToolbar({
  breadcrumb,
  breakpoints,
  dimensions,
  isFullscreen,
  onFullscreenToggle,
}: DemoToolbarProps) {
  return (
    <Grid
      columns="minmax(0, 1fr) auto minmax(0, 1fr)"
      align="center"
      minHeight="32px"
      margin="0"
      padding="xs xl"
    >
      <DemoBreadcrumbs items={breadcrumb} />
      <DemoDimensions breakpoints={breakpoints} dimensions={dimensions} />
      <Flex justify="end">
        <DemoFullscreenButton isFullscreen={isFullscreen} onClick={onFullscreenToggle} />
      </Flex>
    </Grid>
  );
}

interface DemoBreadcrumbsProps {
  items: HeadingBreadcrumb[];
}

function DemoBreadcrumbs({items}: DemoBreadcrumbsProps) {
  return (
    <Flex
      align="center"
      gap="sm"
      minWidth="0"
      overflow="hidden"
      containerType="inline-size"
    >
      {items.length > 0 && (
        <Fragment>
          <Flex align="center" minWidth="0" flex="0 1 auto">
            <BreadcrumbList
              items={items.slice(0, -1).map(item => ({type: 'link', ...item}))}
            />
          </Flex>
          <Flex align="center" minWidth="0" flexGrow={1}>
            <BreadcrumbList.Title
              item={{type: 'page-title', label: items.at(-1)?.label ?? ''}}
            />
          </Flex>
        </Fragment>
      )}
    </Flex>
  );
}

interface DemoDimensionsProps {
  breakpoints: ContainerBreakpoint[];
  dimensions: DemoSize;
}

function DemoDimensions({breakpoints, dimensions}: DemoDimensionsProps) {
  return (
    <Flex align="center" justify="center" gap="sm">
      <DemoDimension breakpoints={breakpoints} size={dimensions.width} />
      <Text monospace variant="muted">
        ×
      </Text>
      <DemoDimension breakpoints={breakpoints} size={dimensions.height} />
    </Flex>
  );
}

interface DemoDimensionProps {
  breakpoints: ContainerBreakpoint[];
  size: number;
}

function DemoDimension({breakpoints, size}: DemoDimensionProps) {
  return (
    <Fragment>
      <Container display="inline-block" width="4ch">
        <Text align="right">{getActiveBreakpoint(breakpoints, size)}</Text>
      </Container>
      <Text variant="muted" tabular>
        ({Math.round(size)}px)
      </Text>
    </Fragment>
  );
}

interface DemoFullscreenButtonProps {
  isFullscreen: boolean;
  onClick: () => void;
}

function DemoFullscreenButton({isFullscreen, onClick}: DemoFullscreenButtonProps) {
  if (!screenfull.isEnabled) {
    return null;
  }

  const label = isFullscreen ? t('Exit full screen') : t('Enter full screen');

  return (
    <RevealOnHover.Action>
      <Button
        size="zero"
        tooltipProps={{title: label}}
        aria-label={label}
        icon={isFullscreen ? <IconContract size="xs" /> : <IconExpand size="xs" />}
        onClick={onClick}
      />
    </RevealOnHover.Action>
  );
}

function getHeadingBreadcrumb(element: HTMLElement | null): HeadingBreadcrumb[] {
  if (!element) {
    return [];
  }

  const outline: HeadingBreadcrumb[] = [];
  const headings = document.querySelectorAll<HTMLHeadingElement>(
    'h1, h2, h3, h4, h5, h6'
  );

  for (const heading of headings) {
    if (!(heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      continue;
    }

    const level = Number(heading.tagName[1]);
    outline[level - 1] = {
      label: heading.textContent?.trim() ?? '',
      to: heading.id
        ? `#${heading.id}`
        : `${window.location.pathname}${window.location.search}`,
    };
    outline.length = level;
  }

  return outline.filter(item => item.label);
}

function useContainerBreakpoints(): ContainerBreakpoint[] {
  const theme = useTheme();
  return useMemo(
    () =>
      (Object.entries(theme.container) as Array<[ContainerBreakpointSize, string]>)
        .map(([key, value]) => [key, parseInt(value, 10)] as ContainerBreakpoint)
        .filter(([key, px]) => key !== 'zero' && px > 0)
        .sort((a, b) => a[1] - b[1]),
    [theme.container]
  );
}

function getActiveBreakpoint(
  breakpoints: ContainerBreakpoint[],
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
  breakpoints: ContainerBreakpoint[];
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
      background="tertiary"
      borderTop="primary"
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
  --bg: ${p => p.theme.tokens.background.tertiary};
  --fill: ${p => p.theme.tokens.background.secondary};
  background-color: var(--bg);
  background-image: conic-gradient(
    var(--fill) 25%,
    var(--bg) 0 50%,
    var(--fill) 0 75%,
    var(--bg) 0
  );
  background-size: 8px 8px;
  background-position: center;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;

  &:fullscreen {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 0;
  }

  /* Hide borders on ticks before the hovered one (previous siblings via :has) */
  ${TickButton}:has(~ ${TickButton}:hover) {
    border-color: transparent;
  }
`;
