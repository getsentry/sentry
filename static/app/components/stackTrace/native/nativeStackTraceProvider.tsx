import {useCallback, useMemo, useState} from 'react';

import {createStackTraceRowPolicy} from 'sentry/components/stackTrace/rowPolicy';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {
  StackTraceProviderProps,
  StackTraceView,
} from 'sentry/components/stackTrace/types';

import {
  getNativeDisplayOptionDefaults,
  getNativeDisplayOptions,
  useNativeDisplayOptionsStorage,
} from './nativeDisplayOptionsPersistence';
import {analyzeNativeFrames} from './nativeFrameAnalysis';
import {
  NativeStackTraceContext,
  type NativeStackTraceContextValue,
} from './nativeStackTraceContext';

interface NativeStackTraceProviderProps extends StackTraceProviderProps {
  displayOptionsStorageKey?: string;
  groupingCurrentLevel?: number;
  isHoverPreviewed?: boolean;
}

export function NativeStackTraceProvider({
  children,
  displayOptionsStorageKey,
  groupingCurrentLevel,
  isHoverPreviewed = false,
  ...stackTraceProps
}: NativeStackTraceProviderProps) {
  const {event, minifiedStacktrace, stacktrace} = stackTraceProps;
  const {hasMinifiedStacktrace, isMinified, isNewestFirst, view} =
    useStackTraceViewState();
  const activeStacktrace =
    isMinified && minifiedStacktrace ? minifiedStacktrace : stacktrace;
  const activeFrames = useMemo(
    () => activeStacktrace.frames ?? [],
    [activeStacktrace.frames]
  );
  const [persistedOptions, setPersistedOptions] = useNativeDisplayOptionsStorage(
    displayOptionsStorageKey
  );
  const {
    defaultAbsoluteAddresses,
    defaultAbsoluteFilePaths,
    defaultVerboseFunctionNames,
  } = getNativeDisplayOptionDefaults({
    hasMinifiedStacktrace,
    persistedOptions,
  });

  const [absoluteAddresses, setAbsoluteAddresses] = useState(defaultAbsoluteAddresses);
  const [absoluteFilePaths, setAbsoluteFilePaths] = useState(defaultAbsoluteFilePaths);
  const [verboseFunctionNames, setVerboseFunctionNames] = useState(
    defaultVerboseFunctionNames
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

  const persistDisplayOptions = useCallback(
    (
      options: Partial<{
        absoluteAddresses: boolean;
        absoluteFilePaths: boolean;
        isMinified: boolean;
        verboseFunctionNames: boolean;
        view: StackTraceView;
      }>
    ) => {
      if (!displayOptionsStorageKey) {
        return;
      }

      setPersistedOptions(
        getNativeDisplayOptions({
          absoluteAddresses: options.absoluteAddresses ?? absoluteAddresses,
          absoluteFilePaths: options.absoluteFilePaths ?? absoluteFilePaths,
          isMinified: options.isMinified ?? isMinified,
          verboseFunctionNames: options.verboseFunctionNames ?? verboseFunctionNames,
          view: options.view ?? view,
        })
      );
    },
    [
      absoluteAddresses,
      absoluteFilePaths,
      displayOptionsStorageKey,
      isMinified,
      setPersistedOptions,
      verboseFunctionNames,
      view,
    ]
  );

  const value = useMemo<NativeStackTraceContextValue>(
    () => ({
      absoluteAddresses,
      absoluteFilePaths,
      hasAbsoluteAddresses,
      hasAbsoluteFilePaths,
      hasAnyStatusIcons,
      hasVerboseFunctionNames,
      imageByFrameIndex,
      isHoverPreviewed,
      maxLengthOfRelativeAddress,
      persistDisplayOptions,
      setAbsoluteAddresses,
      setAbsoluteFilePaths,
      setVerboseFunctionNames,
      verboseFunctionNames,
    }),
    [
      absoluteAddresses,
      absoluteFilePaths,
      hasAbsoluteAddresses,
      hasAbsoluteFilePaths,
      hasAnyStatusIcons,
      hasVerboseFunctionNames,
      imageByFrameIndex,
      isHoverPreviewed,
      maxLengthOfRelativeAddress,
      persistDisplayOptions,
      setAbsoluteAddresses,
      setAbsoluteFilePaths,
      setVerboseFunctionNames,
      verboseFunctionNames,
    ]
  );

  return (
    <StackTraceProvider
      {...stackTraceProps}
      defaultExpandedFrameIndex={defaultExpandedFrameIndex}
      emptySourceNotation
      rowPolicy={rowPolicy}
    >
      <NativeStackTraceContext.Provider value={value}>
        {children}
      </NativeStackTraceContext.Provider>
    </StackTraceProvider>
  );
}
