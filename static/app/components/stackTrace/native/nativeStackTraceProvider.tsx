import {useMemo} from 'react';

import {createStackTraceRowPolicy} from 'sentry/components/stackTrace/rowPolicy';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {StackTraceProviderProps} from 'sentry/components/stackTrace/types';

import {analyzeNativeFrames} from './nativeFrameAnalysis';
import {NativeStackTraceContext} from './nativeStackTraceContext';
import type {NativeStackTraceContextValue} from './nativeStackTraceContext';

interface NativeStackTraceProviderProps extends Pick<
  StackTraceProviderProps,
  | 'children'
  | 'collapseAll'
  | 'event'
  | 'exceptionIndex'
  | 'frameSourceMapDebuggerData'
  | 'hasScmSourceContext'
  | 'hideSourceMapDebugger'
  | 'maxDepth'
  | 'meta'
  | 'minifiedStacktrace'
  | 'platform'
  | 'stacktrace'
> {
  groupingCurrentLevel?: number;
  isHoverPreviewed?: boolean;
}

export function NativeStackTraceProvider({
  children,
  collapseAll,
  event,
  exceptionIndex,
  frameSourceMapDebuggerData,
  groupingCurrentLevel,
  hasScmSourceContext,
  hideSourceMapDebugger,
  isHoverPreviewed = false,
  maxDepth,
  meta,
  minifiedStacktrace,
  platform,
  stacktrace,
}: NativeStackTraceProviderProps) {
  const {isMinified, isNewestFirst} = useStackTraceViewState();
  const activeStacktrace =
    isMinified && minifiedStacktrace ? minifiedStacktrace : stacktrace;
  const activeFrames = useMemo(
    () => activeStacktrace.frames ?? [],
    [activeStacktrace.frames]
  );
  const {
    imageByFrameIndex,
    maxLengthOfRelativeAddress,
    hasAnyStatusIcons,
    hasAbsoluteAddresses,
    hasAbsoluteFilePaths,
    hasVerboseFunctionNames,
  } = useMemo(
    () => analyzeNativeFrames({event, frames: activeFrames}),
    [activeFrames, event]
  );

  const defaultExpandedFrameIndex = useMemo(() => {
    const inAppFrameIndex = isNewestFirst
      ? activeFrames.findLastIndex(frame => frame.inApp)
      : activeFrames.findIndex(frame => frame.inApp);

    return inAppFrameIndex === -1 ? null : inAppFrameIndex;
  }, [activeFrames, isNewestFirst]);

  const rowPolicy = useMemo(
    () =>
      createStackTraceRowPolicy({
        groupingCurrentLevel,
        hideDartAsyncSuspensionFrames: true,
      }),
    [groupingCurrentLevel]
  );

  const value = useMemo<NativeStackTraceContextValue>(
    () => ({
      hasAbsoluteAddresses,
      hasAbsoluteFilePaths,
      hasAnyStatusIcons,
      hasVerboseFunctionNames,
      imageByFrameIndex,
      isHoverPreviewed,
      maxLengthOfRelativeAddress,
    }),
    [
      hasAbsoluteAddresses,
      hasAbsoluteFilePaths,
      hasAnyStatusIcons,
      hasVerboseFunctionNames,
      imageByFrameIndex,
      isHoverPreviewed,
      maxLengthOfRelativeAddress,
    ]
  );

  return (
    <StackTraceProvider
      collapseAll={collapseAll}
      defaultExpandedFrameIndex={defaultExpandedFrameIndex}
      emptySourceNotation
      event={event}
      exceptionIndex={exceptionIndex}
      frameSourceMapDebuggerData={frameSourceMapDebuggerData}
      hasScmSourceContext={hasScmSourceContext}
      hideSourceMapDebugger={hideSourceMapDebugger}
      maxDepth={maxDepth}
      meta={meta}
      minifiedStacktrace={minifiedStacktrace}
      platform={platform}
      rowPolicy={rowPolicy}
      stacktrace={stacktrace}
    >
      <NativeStackTraceContext value={value}>{children}</NativeStackTraceContext>
    </StackTraceProvider>
  );
}
