import {useEffect, useEffectEvent, useMemo, useState} from 'react';

import {isExpandable as frameHasExpandableDetails} from 'sentry/components/events/interfaces/frame/utils';
import type {Event} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import useProjects from 'sentry/utils/useProjects';
import useSentryAppComponentsStore from 'sentry/utils/useSentryAppComponentsStore';

import {
  createInitialHiddenFrameToggleMap,
  getFrameCountMap,
  getLastFrameIndex,
  getRows,
} from './getRows';
import {StackTraceContext, useStackTraceViewState} from './stackTraceContext';
import type {StackTraceContextValue} from './stackTraceContext';
import type {StackTraceProviderProps} from './types';

function getDefaultPlatform(stacktrace: StacktraceType, event: Event): PlatformKey {
  const framePlatform = stacktrace.frames?.find(frame => !!frame.platform)?.platform;
  return event.platform ?? framePlatform ?? 'other';
}

export function StackTraceProvider({
  children,
  components: componentsProp,
  exceptionIndex,
  event,
  frameSourceMapDebuggerData,
  hideSourceMapDebugger,
  minifiedStacktrace,
  stacktrace,
  maxDepth,
  meta,
  platform: platformProp,
}: StackTraceProviderProps) {
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();

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

  const activeStacktrace =
    isMinified && minifiedStacktrace ? minifiedStacktrace : stacktrace;
  const frames = useMemo(() => activeStacktrace.frames ?? [], [activeStacktrace.frames]);
  const components = useMemo(
    () => componentsProp ?? storeStacktraceLinkComponents,
    [componentsProp, storeStacktraceLinkComponents]
  );
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(candidate => candidate.id === event.projectID),
    [event.projectID, projects]
  );
  const lastFrameIndex = useMemo(() => getLastFrameIndex(frames), [frames]);

  const [hiddenFrameToggleMap, setHiddenFrameToggleMap] = useState(() =>
    createInitialHiddenFrameToggleMap(frames, view === 'full')
  );

  const platform = platformProp ?? getDefaultPlatform(activeStacktrace, event);
  const shouldIncludeSystemFrames = view === 'full';

  const setHiddenFrameToggleMapEvent = useEffectEvent((includeSystemFrames: boolean) => {
    setHiddenFrameToggleMap(
      createInitialHiddenFrameToggleMap(frames, includeSystemFrames)
    );
  });

  useEffect(() => {
    setHiddenFrameToggleMapEvent(shouldIncludeSystemFrames);
  }, [shouldIncludeSystemFrames]);

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

  const hasAnyExpandableFrames = useMemo(
    () =>
      rows.some(row => {
        if (row.kind !== 'frame') {
          return false;
        }

        const registers =
          row.frameIndex === frames.length - 1 ? activeStacktrace.registers : {};

        return frameHasExpandableDetails({
          frame: row.frame,
          registers,
          platform,
        });
      }),
    [rows, frames.length, activeStacktrace.registers, platform]
  );

  const value = useMemo<StackTraceContextValue>(
    () => ({
      components,
      exceptionIndex,
      event,
      hasAnyExpandableFrames,
      platform,
      project,
      stacktrace: activeStacktrace,
      frameSourceMapDebuggerData,
      frames,
      hideSourceMapDebugger: hideSourceMapDebugger ?? false,
      rows,
      meta,
      hiddenFrameToggleMap,
      lastFrameIndex,
      toggleHiddenFrames: (frameIndex: number) => {
        setHiddenFrameToggleMap(prevState => ({
          ...prevState,
          [frameIndex]: !prevState[frameIndex],
        }));
      },
    }),
    [
      components,
      exceptionIndex,
      event,
      frameSourceMapDebuggerData,
      frames,
      hasAnyExpandableFrames,
      hideSourceMapDebugger,
      hiddenFrameToggleMap,
      lastFrameIndex,
      meta,
      platform,
      project,
      rows,
      activeStacktrace,
    ]
  );

  return (
    <StackTraceContext.Provider value={value}>{children}</StackTraceContext.Provider>
  );
}
