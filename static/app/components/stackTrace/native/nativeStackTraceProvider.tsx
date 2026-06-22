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
  type NativeStackTraceDisplayOptions,
  type NativeStackTraceContextValue,
} from './nativeStackTraceContext';

interface NativeStackTraceProviderProps extends StackTraceProviderProps {
  displayOptionsStorageKey?: string;
  groupingCurrentLevel?: number;
  inheritedDisplayOptions?: NativeStackTraceDisplayOptions;
  isHoverPreviewed?: boolean;
}

export function NativeStackTraceProvider({
  children,
  displayOptionsStorageKey,
  groupingCurrentLevel,
  inheritedDisplayOptions,
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

  const [localAbsoluteAddresses, setLocalAbsoluteAddresses] = useState(
    defaultAbsoluteAddresses
  );
  const [localAbsoluteFilePaths, setLocalAbsoluteFilePaths] = useState(
    defaultAbsoluteFilePaths
  );
  const [localVerboseFunctionNames, setLocalVerboseFunctionNames] = useState(
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

  const persistLocalDisplayOptions = useCallback(
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
          absoluteAddresses: options.absoluteAddresses ?? localAbsoluteAddresses,
          absoluteFilePaths: options.absoluteFilePaths ?? localAbsoluteFilePaths,
          isMinified: options.isMinified ?? isMinified,
          verboseFunctionNames: options.verboseFunctionNames ?? localVerboseFunctionNames,
          view: options.view ?? view,
        })
      );
    },
    [
      displayOptionsStorageKey,
      isMinified,
      localAbsoluteAddresses,
      localAbsoluteFilePaths,
      localVerboseFunctionNames,
      setPersistedOptions,
      view,
    ]
  );
  const localDisplayOptions = useMemo<NativeStackTraceDisplayOptions>(
    () => ({
      absoluteAddresses: localAbsoluteAddresses,
      absoluteFilePaths: localAbsoluteFilePaths,
      persistDisplayOptions: persistLocalDisplayOptions,
      setAbsoluteAddresses: setLocalAbsoluteAddresses,
      setAbsoluteFilePaths: setLocalAbsoluteFilePaths,
      setVerboseFunctionNames: setLocalVerboseFunctionNames,
      verboseFunctionNames: localVerboseFunctionNames,
    }),
    [
      localAbsoluteAddresses,
      localAbsoluteFilePaths,
      localVerboseFunctionNames,
      persistLocalDisplayOptions,
    ]
  );

  // Nested native stack traces should share the user-controlled display
  // options from their parent, while keeping frame analysis local below.
  const displayOptions = inheritedDisplayOptions ?? localDisplayOptions;

  const value = useMemo<NativeStackTraceContextValue>(
    () => ({
      ...displayOptions,
      hasAbsoluteAddresses,
      hasAbsoluteFilePaths,
      hasAnyStatusIcons,
      hasVerboseFunctionNames,
      imageByFrameIndex,
      isHoverPreviewed,
      maxLengthOfRelativeAddress,
    }),
    [
      displayOptions,
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
