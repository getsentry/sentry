import {Fragment, useContext, useEffect, useId, useMemo, useState} from 'react';
import styled from '@emotion/styled';

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

import {
  ChevronAction,
  HiddenFramesToggleAction,
  SourceLinkAction,
  SourceMapsDebuggerAction,
} from './frame/actions';
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
  StackTraceSharedViewContext,
  useStackTraceContext,
} from './stackTraceContext';
import type {
  StackTraceContextValue,
  StackTraceFrameContextValue,
} from './stackTraceContext';
import {CopyButton, DisplayOptions, DownloadButton, Toolbar} from './toolbar';
import type {FrameRow, StackTraceProviderProps, StackTraceView} from './types';

function getDefaultPlatform(stacktrace: StacktraceType, event: Event): PlatformKey {
  const framePlatform = stacktrace.frames?.find(frame => !!frame.platform)?.platform;
  return framePlatform ?? event.platform ?? 'other';
}

function Root({
  children,
  components: componentsProp,
  defaultIsMinified = false,
  event,
  frameSourceMapDebuggerData,
  getFrameLineCoverage,
  hideSourceMapDebugger = false,
  lockAddress,
  minifiedStacktrace,
  stacktrace,
  defaultView = 'app',
  defaultIsNewestFirst = true,
  maxDepth,
  meta,
  platform: platformProp,
  threadId,
}: StackTraceProviderProps) {
  const sharedView = useContext(StackTraceSharedViewContext);

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

  const [localIsMinified, setLocalIsMinified] = useState(
    () => !!minifiedStacktrace && defaultIsMinified
  );
  const [localView, setLocalView] = useState<StackTraceView>(defaultView);
  const [localIsNewestFirst, setLocalIsNewestFirst] = useState(defaultIsNewestFirst);

  const view = sharedView?.view ?? localView;
  const setView = sharedView?.setView ?? setLocalView;
  const isNewestFirst = sharedView?.isNewestFirst ?? localIsNewestFirst;
  const setIsNewestFirst = sharedView?.setIsNewestFirst ?? setLocalIsNewestFirst;
  const isMinified = sharedView?.isMinified ?? localIsMinified;
  const setIsMinified = sharedView?.setIsMinified ?? setLocalIsMinified;
  const hasMinifiedStacktrace = sharedView?.hasMinifiedStacktrace ?? !!minifiedStacktrace;

  const activeStacktrace =
    isMinified && minifiedStacktrace ? minifiedStacktrace : stacktrace;
  const frames = useMemo(() => activeStacktrace.frames ?? [], [activeStacktrace.frames]);
  const components = useMemo(
    () => componentsProp ?? storeStacktraceLinkComponents,
    [componentsProp, storeStacktraceLinkComponents]
  );

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

  const platform = platformProp ?? getDefaultPlatform(activeStacktrace, event);
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
        framesOmitted: activeStacktrace.framesOmitted,
        maxDepth,
      }),
    [
      frameCountMap,
      frames,
      hiddenFrameToggleMap,
      isNewestFirst,
      maxDepth,
      shouldIncludeSystemFrames,
      activeStacktrace.framesOmitted,
    ]
  );

  const value = useMemo<StackTraceContextValue>(
    () => ({
      components,
      event,
      platform,
      stacktrace: activeStacktrace,
      frameSourceMapDebuggerData,
      frames,
      getFrameLineCoverage,
      hideSourceMapDebugger,
      rows,
      meta,
      view,
      setView,
      hasMinifiedStacktrace,
      isMinified,
      setIsMinified,
      isNewestFirst,
      setIsNewestFirst,
      expandedFrames,
      hiddenFrameToggleMap,
      lastFrameIndex: getLastFrameIndex(frames),
      lockAddress,
      toggleFrameExpansion: (frameIndex: number) => {
        setExpandedFrames(prevState => {
          return {
            ...prevState,
            [frameIndex]: !prevState[frameIndex],
          };
        });
      },
      toggleHiddenFrames: (frameIndex: number) => {
        setHiddenFrameToggleMap(prevState => ({
          ...prevState,
          [frameIndex]: !prevState[frameIndex],
        }));
      },
      threadId,
    }),
    [
      components,
      event,
      expandedFrames,
      frameSourceMapDebuggerData,
      frames,
      getFrameLineCoverage,
      hasMinifiedStacktrace,
      hideSourceMapDebugger,
      hiddenFrameToggleMap,
      isMinified,
      isNewestFirst,
      lockAddress,
      meta,
      platform,
      rows,
      setIsMinified,
      setIsNewestFirst,
      setView,
      activeStacktrace,
      threadId,
      view,
    ]
  );

  return (
    <StackTraceContext.Provider value={value}>{children}</StackTraceContext.Provider>
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
  const frameContextId = useId();

  const value = useMemo<StackTraceFrameContextValue>(
    () => ({
      event,
      frame: row.frame,
      frameContextId,
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
      frameContextId,
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
      <Text size="xs" variant="muted">
        {t('Frames %d to %d were omitted and not available.', start, end)}
      </Text>
    </OmittedRow>
  );
}

function Frames() {
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
    <FramesPanel>
      <FrameList aria-label={t('Stack frames')}>
        {rows.map(row => {
          if (row.kind === 'omitted') {
            return (
              <OmittedFramesBanner key={row.rowKey} omittedFrames={row.omittedFrames} />
            );
          }

          return <FrameRoot key={row.frameIndex} row={row} />;
        })}
      </FrameList>
    </FramesPanel>
  );
}

const FramesPanel = styled(Panel)`
  overflow: hidden;
`;

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

const OmittedRow = styled(Container)`
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

function FrameActionsContainer({children}: {children: React.ReactNode}) {
  return (
    <Flex gap="xs" align="center">
      {children}
    </Flex>
  );
}

const FrameActions = Object.assign(FrameActionsContainer, {
  Chevron: ChevronAction,
  HiddenFramesToggle: HiddenFramesToggleAction,
  SourceLink: SourceLinkAction,
  SourceMapsDebugger: SourceMapsDebuggerAction,
});

const Frame = Object.assign(FrameRoot, {
  Context: FrameContext,
  Header: FrameHeader,
  Actions: FrameActions,
});

export const StackTraceProvider = Object.assign(Root, {
  Frames,
  Frame,
  DisplayOptions,
  CopyButton,
  DownloadButton,
  Toolbar,
});

export {useStackTraceContext};
