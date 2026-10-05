import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {
  NATIVE_DISPLAY_OPTION,
  updateNativeDisplayOption,
  type NativePersistedDisplayOption,
} from 'sentry/components/stackTrace/native/nativeDisplayOptionsPersistence';
import {StackTraceViewStateContext} from 'sentry/components/stackTrace/stackTraceContext';
import type {
  StackTraceView,
  StackTraceViewState,
  StackTraceViewStateProviderProps,
} from 'sentry/components/stackTrace/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

interface NativeDisplayOptionsContextValue {
  absoluteAddresses: boolean;
  absoluteFilePaths: boolean;
  setAbsoluteAddresses: (absoluteAddresses: boolean) => void;
  setAbsoluteFilePaths: (absoluteFilePaths: boolean) => void;
  setVerboseFunctionNames: (verboseFunctionNames: boolean) => void;
  verboseFunctionNames: boolean;
}

interface StackTraceDisplayOptionsProviderProps extends StackTraceViewStateProviderProps {
  /** Saves display options to localStorage under this key when set. */
  storageKey?: string;
}

type PersistedOptions = NativePersistedDisplayOption[];
type SetPersistedOptions = React.Dispatch<React.SetStateAction<PersistedOptions>>;

const NativeDisplayOptionsContext =
  createContext<NativeDisplayOptionsContextValue | null>(null);

function getInitialDisplayOptions(
  storedValue: unknown,
  {defaultIsMinified, defaultView}: StackTraceDisplayOptionsProviderProps
): PersistedOptions {
  return Object.values(NATIVE_DISPLAY_OPTION).filter(
    option =>
      (Array.isArray(storedValue) && storedValue.includes(option)) ||
      (defaultIsMinified && option === NATIVE_DISPLAY_OPTION.MINIFIED) ||
      (defaultView === 'raw' && option === NATIVE_DISPLAY_OPTION.RAW_STACK_TRACE)
  );
}

/**
 * Stack trace view state plus native frame detail options, shared by native
 * and non-native issue stack traces.
 */
export function StackTraceDisplayOptionsProvider({
  storageKey,
  ...props
}: StackTraceDisplayOptionsProviderProps) {
  if (storageKey) {
    return (
      <PersistedStackTraceDisplayOptionsProvider storageKey={storageKey} {...props} />
    );
  }

  return <LocalStackTraceDisplayOptionsProvider {...props} />;
}

function PersistedStackTraceDisplayOptionsProvider({
  storageKey,
  ...props
}: Omit<StackTraceDisplayOptionsProviderProps, 'storageKey'> & {storageKey: string}) {
  const [persistedOptions, setPersistedOptions] = useLocalStorageState<PersistedOptions>(
    storageKey,
    storedValue => getInitialDisplayOptions(storedValue, props)
  );

  return (
    <StackTraceDisplayOptionsRoot
      key={storageKey}
      persistedOptions={persistedOptions}
      setPersistedOptions={setPersistedOptions}
      {...props}
    />
  );
}

function LocalStackTraceDisplayOptionsProvider(
  props: Omit<StackTraceDisplayOptionsProviderProps, 'storageKey'>
) {
  const [persistedOptions, setPersistedOptions] = useState<PersistedOptions>(() =>
    getInitialDisplayOptions(undefined, props)
  );

  return (
    <StackTraceDisplayOptionsRoot
      {...props}
      persistedOptions={persistedOptions}
      setPersistedOptions={setPersistedOptions}
    />
  );
}

function StackTraceDisplayOptionsRoot({
  children,
  defaultView = 'app',
  hasMinifiedStacktrace = false,
  persistedOptions,
  setPersistedOptions,
  defaultIsNewestFirst = true,
  platform,
}: Omit<StackTraceDisplayOptionsProviderProps, 'storageKey'> & {
  persistedOptions: PersistedOptions;
  setPersistedOptions: SetPersistedOptions;
}) {
  // Preferences survive thread changes; effective settings depend on available data.
  const [selectedView, setSelectedView] = useState<StackTraceView | null>(null);
  const [isNewestFirst, setIsNewestFirst] = useState(defaultIsNewestFirst);
  const view =
    selectedView ??
    (persistedOptions.includes(NATIVE_DISPLAY_OPTION.RAW_STACK_TRACE)
      ? 'raw'
      : defaultView);
  const isMinified =
    hasMinifiedStacktrace && persistedOptions.includes(NATIVE_DISPLAY_OPTION.MINIFIED);
  const setOption = useCallback(
    (option: NativePersistedDisplayOption, enabled: boolean) => {
      setPersistedOptions(previous =>
        updateNativeDisplayOption(previous, option, enabled)
      );
    },
    [setPersistedOptions]
  );
  const viewState = useMemo<StackTraceViewState>(
    () => ({
      view,
      setView: nextView => {
        setSelectedView(nextView);
        setOption(NATIVE_DISPLAY_OPTION.RAW_STACK_TRACE, nextView === 'raw');
      },
      isMinified,
      setIsMinified: enabled => setOption(NATIVE_DISPLAY_OPTION.MINIFIED, enabled),
      isNewestFirst,
      setIsNewestFirst,
      hasMinifiedStacktrace,
      platform,
    }),
    [view, isMinified, isNewestFirst, hasMinifiedStacktrace, platform, setOption]
  );
  const displayOptions = useMemo<NativeDisplayOptionsContextValue>(
    () => ({
      absoluteAddresses: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES
      ),
      absoluteFilePaths: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS
      ),
      setAbsoluteAddresses: enabled =>
        setOption(NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES, enabled),
      setAbsoluteFilePaths: enabled =>
        setOption(NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS, enabled),
      setVerboseFunctionNames: enabled =>
        setOption(NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES, enabled),
      verboseFunctionNames: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES
      ),
    }),
    [persistedOptions, setOption]
  );

  return (
    <StackTraceViewStateContext value={viewState}>
      <NativeDisplayOptionsContext value={displayOptions}>
        {children}
      </NativeDisplayOptionsContext>
    </StackTraceViewStateContext>
  );
}

export function useNativeDisplayOptionsContext() {
  const context = useContext(NativeDisplayOptionsContext);
  if (!context) {
    throw new Error(
      'useNativeDisplayOptionsContext must be used within StackTraceDisplayOptionsProvider'
    );
  }
  return context;
}
