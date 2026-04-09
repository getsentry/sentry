import {useCallback, useMemo, useState} from 'react';

import {isExpandable as frameHasExpandableDetails} from 'sentry/components/events/interfaces/frame/utils';
import {getLastFrameIndex} from 'sentry/components/events/interfaces/utils';
import type {Event} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {useProjects} from 'sentry/utils/useProjects';

import {createInitialHiddenFrameToggleMap, getFrameCountMap, getRows} from './getRows';
import {StackTraceContext, useStackTraceViewState} from './stackTraceContext';
import type {StackTraceContextValue} from './stackTraceContext';
import type {StackTraceProviderProps} from './types';

function getDefaultPlatform(stacktrace: StacktraceType, event: Event): PlatformKey {
  const framePlatform = stacktrace.frames?.find(frame => !!frame.platform)?.platform;
  return event.platform ?? framePlatform ?? 'other';
}

export function StackTraceProvider({
  children,
  exceptionIndex,
  event,
  frameSourceMapDebuggerData,
  hasScmSourceContext,
  hideSourceMapDebugger,
  minifiedStacktrace,
  stacktrace,
  maxDepth,
  meta,
  platform: platformProp,
}: StackTraceProviderProps) {
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();

  const activeStacktrace =
    isMinified && minifiedStacktrace ? minifiedStacktrace : stacktrace;
  const frames = useMemo(() => activeStacktrace.frames ?? [], [activeStacktrace.frames]);
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(candidate => candidate.id === event.projectID),
    [event.projectID, projects]
  );
  const lastFrameIndex = useMemo(
    () => getLastFrameIndex(frames) ?? frames.length - 1,
    [frames]
  );

  const [hiddenFrameToggleMap, setHiddenFrameToggleMap] = useState(() =>
    createInitialHiddenFrameToggleMap(frames, view === 'full')
  );

  const platform = platformProp ?? getDefaultPlatform(activeStacktrace, event);
  const shouldIncludeSystemFrames = view === 'full';

  const frameCountMap = useMemo(
    () => getFrameCountMap(frames, shouldIncludeSystemFrames),
    [frames, shouldIncludeSystemFrames]
  );

  const allRows = useMemo(
    () =>
      getRows({
        frames,
        includeSystemFrames: true,
        hiddenFrameToggleMap: {},
        frameCountMap: {},
        newestFirst: isNewestFirst,
        framesOmitted: activeStacktrace.framesOmitted,
      }),
    [frames, isNewestFirst, activeStacktrace.framesOmitted]
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
          hasScmSourceContext,
        });
      }),
    [rows, frames.length, activeStacktrace.registers, platform, hasScmSourceContext]
  );

  const toggleHiddenFrames = useCallback((frameIndex: number) => {
    setHiddenFrameToggleMap(prevState => ({
      ...prevState,
      [frameIndex]: !prevState[frameIndex],
    }));
  }, []);

  const value = useMemo<StackTraceContextValue>(
    () => ({
      allRows,
      exceptionIndex,
      event,
      hasAnyExpandableFrames,
      hasScmSourceContext: hasScmSourceContext ?? false,
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
      toggleHiddenFrames,
    }),
    [
      allRows,
      exceptionIndex,
      event,
      frameSourceMapDebuggerData,
      frames,
      hasAnyExpandableFrames,
      hasScmSourceContext,
      hideSourceMapDebugger,
      hiddenFrameToggleMap,
      lastFrameIndex,
      meta,
      platform,
      project,
      rows,
      activeStacktrace,
      toggleHiddenFrames,
    ]
  );

  return (
    <StackTraceContext.Provider value={value}>{children}</StackTraceContext.Provider>
  );
}
