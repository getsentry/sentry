import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {isExpandable as frameHasExpandableDetails} from 'sentry/components/events/interfaces/frame/utils';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import useSentryAppComponentsStore from 'sentry/utils/useSentryAppComponentsStore';

import {FrameContext} from './frame/frameContext';
import {FrameHeader} from './frame/frameHeader';
import {
  createInitialHiddenFrameToggleMap,
  getFrameCountMap,
  getLastFrameIndex,
  getRows,
} from './rows/getRows';
import {
  StackTraceContext,
  StackTraceFrameContext,
  useStackTraceContext,
  useStackTraceFrameContext,
} from './stackTraceContext';
import type {
  StackTraceContextValue,
  StackTraceFrameContextValue,
} from './stackTraceContext';
import type {FrameRow, StackTraceRootProps, StackTraceView} from './types';

export type {StackTraceView} from './types';

function getDefaultPlatform(stacktrace: StacktraceType, event: Event): PlatformKey {
  const framePlatform = stacktrace.frames?.find(frame => !!frame.platform)?.platform;
  return framePlatform ?? event.platform ?? 'other';
}

function Root({
  children,
  components: componentsProp,
  event,
  stacktrace,
  defaultView = 'app',
  defaultIsNewestFirst = true,
  maxDepth,
  meta,
  platform: platformProp,
}: StackTraceRootProps) {
  const storeComponents = useSentryAppComponentsStore({componentType: 'stacktrace-link'});
  const storeStacktraceLinkComponents = useMemo(
    () =>
      storeComponents.filter(
        (component): component is SentryAppComponent<SentryAppSchemaStacktraceLink> =>
          component.type === 'stacktrace-link' &&
          component.schema.type === 'stacktrace-link'
      ),
    [storeComponents]
  );
  const frames = useMemo(() => stacktrace.frames ?? [], [stacktrace.frames]);
  const components = useMemo(
    () => componentsProp ?? storeStacktraceLinkComponents,
    [componentsProp, storeStacktraceLinkComponents]
  );

  const [view, setView] = useState<StackTraceView>(defaultView);
  const [isNewestFirst, setIsNewestFirst] = useState(defaultIsNewestFirst);

  const [hiddenFrameToggleMap, setHiddenFrameToggleMap] = useState(() =>
    createInitialHiddenFrameToggleMap(frames, defaultView === 'full')
  );

  const [expandedFrames, setExpandedFrames] = useState<Record<number, boolean>>(() => {
    const expandedMap: Record<number, boolean> = {};
    const lastFrameIndex = getLastFrameIndex(frames);
    if (lastFrameIndex >= 0) {
      expandedMap[lastFrameIndex] = true;
    }
    return expandedMap;
  });

  const platform = platformProp ?? getDefaultPlatform(stacktrace, event);
  const shouldIncludeSystemFrames = view === 'full';

  useEffect(() => {
    setHiddenFrameToggleMap(
      createInitialHiddenFrameToggleMap(frames, shouldIncludeSystemFrames)
    );
  }, [frames, shouldIncludeSystemFrames]);

  const frameCountMap = useMemo(
    () => getFrameCountMap(frames, shouldIncludeSystemFrames),
    [frames, shouldIncludeSystemFrames]
  );

  const rows = useMemo(
    () =>
      getRows({
        frames,
        includeSystemFrames: shouldIncludeSystemFrames,
        hiddenFrameToggleMap,
        frameCountMap,
        newestFirst: isNewestFirst,
        framesOmitted: stacktrace.framesOmitted,
        maxDepth,
      }),
    [
      frameCountMap,
      frames,
      hiddenFrameToggleMap,
      isNewestFirst,
      maxDepth,
      shouldIncludeSystemFrames,
      stacktrace.framesOmitted,
    ]
  );

  const value = useMemo<StackTraceContextValue>(
    () => ({
      components,
      event,
      platform,
      stacktrace,
      frames,
      rows,
      meta,
      view,
      setView,
      isNewestFirst,
      setIsNewestFirst,
      expandedFrames,
      hiddenFrameToggleMap,
      lastFrameIndex: getLastFrameIndex(frames),
      toggleFrameExpansion: (frameIndex: number) => {
        setExpandedFrames(prevState => ({
          ...prevState,
          [frameIndex]: !prevState[frameIndex],
        }));
      },
      toggleHiddenFrames: (frameIndex: number) => {
        setHiddenFrameToggleMap(prevState => ({
          ...prevState,
          [frameIndex]: !prevState[frameIndex],
        }));
      },
    }),
    [
      components,
      event,
      expandedFrames,
      frames,
      hiddenFrameToggleMap,
      isNewestFirst,
      meta,
      platform,
      rows,
      stacktrace,
      view,
    ]
  );

  return (
    <StackTraceContext.Provider value={value}>{children}</StackTraceContext.Provider>
  );
}

function ViewSwitcher() {
  const {view, setView} = useStackTraceContext();

  return (
    <Flex gap="sm">
      <Button
        size="sm"
        priority={view === 'app' ? 'primary' : 'default'}
        onClick={() => setView('app')}
      >
        {t('App Frames')}
      </Button>
      <Button
        size="sm"
        priority={view === 'full' ? 'primary' : 'default'}
        onClick={() => setView('full')}
      >
        {t('Full Stack')}
      </Button>
      <Button
        size="sm"
        priority={view === 'raw' ? 'primary' : 'default'}
        onClick={() => setView('raw')}
      >
        {t('Raw')}
      </Button>
    </Flex>
  );
}

function OrderToggle() {
  const {isNewestFirst, setIsNewestFirst} = useStackTraceContext();

  return (
    <Button
      size="sm"
      priority="default"
      onClick={() => setIsNewestFirst(currentValue => !currentValue)}
    >
      {isNewestFirst ? t('Newest First') : t('Oldest First')}
    </Button>
  );
}

function Toolbar() {
  return (
    <Flex justify="between" align="center" gap="sm" wrap="wrap" marginBottom="sm">
      <ViewSwitcher />
      <OrderToggle />
    </Flex>
  );
}

interface StackTraceFrameProps {
  row: FrameRow;
  children?: React.ReactNode;
}

function FrameRoot({row, children}: StackTraceFrameProps) {
  const {
    event,
    frames,
    platform,
    stacktrace,
    expandedFrames,
    hiddenFrameToggleMap,
    toggleFrameExpansion,
    toggleHiddenFrames,
  } = useStackTraceContext();

  const registers = row.frameIndex === frames.length - 1 ? stacktrace.registers : {};

  const isFrameExpandable = frameHasExpandableDetails({
    frame: row.frame,
    registers,
    platform,
  });

  const isExpanded = !!expandedFrames[row.frameIndex];

  const value = useMemo<StackTraceFrameContextValue>(
    () => ({
      event,
      frame: row.frame,
      frameIndex: row.frameIndex,
      hiddenFrameCount: row.hiddenFrameCount,
      hiddenFramesExpanded: !!hiddenFrameToggleMap[row.frameIndex],
      isExpandable: isFrameExpandable,
      isExpanded,
      nextFrame: row.nextFrame,
      platform,
      timesRepeated: row.timesRepeated,
      toggleExpansion: () => {
        toggleFrameExpansion(row.frameIndex);
      },
      toggleHiddenFrames: () => {
        toggleHiddenFrames(row.frameIndex);
      },
    }),
    [
      event,
      hiddenFrameToggleMap,
      isExpanded,
      isFrameExpandable,
      platform,
      row.frame,
      row.frameIndex,
      row.hiddenFrameCount,
      row.nextFrame,
      row.timesRepeated,
      toggleFrameExpansion,
      toggleHiddenFrames,
    ]
  );

  return (
    <StackTraceFrameContext.Provider value={value}>
      <FrameRowContainer data-test-id="core-stacktrace-frame-row">
        {children ?? (
          <Fragment>
            <FrameHeader />
            <FrameContext />
          </Fragment>
        )}
      </FrameRowContainer>
    </StackTraceFrameContext.Provider>
  );
}

function OmittedFramesBanner({omittedFrames}: {omittedFrames: [number, number]}) {
  const [start, end] = omittedFrames;
  return (
    <OmittedRow>
      {t('Frames %d to %d were omitted and not available.', start, end)}
    </OmittedRow>
  );
}

function Content() {
  const {rows, stacktrace, event, view} = useStackTraceContext();

  if (view === 'raw') {
    return (
      <Panel>
        <RawStackTraceText>
          {rawStacktraceContent({data: stacktrace, platform: event.platform})}
        </RawStackTraceText>
      </Panel>
    );
  }

  if (rows.length === 0) {
    return (
      <Container border="primary" radius="md" padding="md">
        <Text variant="muted">{t('No stack trace available')}</Text>
      </Container>
    );
  }

  return (
    <Panel data-test-id="core-stacktrace-content">
      <FrameList data-test-id="core-stacktrace-frame-list">
        {rows.map(row => {
          if (row.kind === 'omitted') {
            return (
              <OmittedFramesBanner key={row.rowKey} omittedFrames={row.omittedFrames} />
            );
          }

          return <FrameRoot key={row.frameIndex} row={row} />;
        })}
      </FrameList>
    </Panel>
  );
}

const FrameList = styled('div')`
  margin: 0;
  padding: 0;
`;

const FrameRowContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding-left: 0;

  &:first-of-type {
    border-top: 0;
  }
`;

const OmittedRow = styled('div')`
  color: #493e54;
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  border-left: 2px solid ${p => p.theme.colors.red400};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.colors.red100};
  padding: ${p => `${p.theme.space.sm} ${p.theme.space.md}`};
`;

const RawStackTraceText = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.md};
  overflow: auto;
  font-size: ${p => p.theme.font.size.sm};
`;

const Frame = Object.assign(FrameRoot, {
  Context: FrameContext,
  Header: FrameHeader,
});

export const StackTrace = Object.assign(Root, {
  Content,
  Frame,
  OrderToggle,
  Toolbar,
  ViewSwitcher,
});

export {useStackTraceContext, useStackTraceFrameContext};
