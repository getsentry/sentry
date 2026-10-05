import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {StackTraceViewStateContext} from 'sentry/components/stackTrace/stackTraceContext';
import type {
  StackTraceView,
  StackTraceViewState,
  StackTraceViewStateProviderProps,
} from 'sentry/components/stackTrace/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

/** Values saved to localStorage, shared with the legacy stack trace. */
export const DISPLAY_OPTION = {
  ABSOLUTE_ADDRESSES: 'absolute-addresses',
  ABSOLUTE_FILE_PATHS: 'absolute-file-paths',
  MINIFIED: 'minified',
  RAW_STACK_TRACE: 'raw-stack-trace',
  VERBOSE_FUNCTION_NAMES: 'verbose-function-names',
} as const;

type DisplayOption = (typeof DISPLAY_OPTION)[keyof typeof DISPLAY_OPTION];

export type NativeFrameDetail =
  | typeof DISPLAY_OPTION.ABSOLUTE_ADDRESSES
  | typeof DISPLAY_OPTION.ABSOLUTE_FILE_PATHS
  | typeof DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES;

interface NativeDisplayOptionsContextValue {
  absoluteAddresses: boolean;
  absoluteFilePaths: boolean;
  setFrameDetail: (option: NativeFrameDetail, enabled: boolean) => void;
  verboseFunctionNames: boolean;
}

interface StackTraceDisplayOptionsProviderProps extends StackTraceViewStateProviderProps {
  /** Saves display options to localStorage under this key when set. */
  storageKey?: string;
}

type PersistedOptions = DisplayOption[];
type SetPersistedOptions = React.Dispatch<React.SetStateAction<PersistedOptions>>;

const NativeDisplayOptionsContext =
  createContext<NativeDisplayOptionsContextValue | null>(null);

function getInitialDisplayOptions(
  storedValue: unknown,
  {defaultIsMinified, defaultView}: StackTraceDisplayOptionsProviderProps
): PersistedOptions {
  return Object.values(DISPLAY_OPTION).filter(
    option =>
      (Array.isArray(storedValue) && storedValue.includes(option)) ||
      (defaultIsMinified && option === DISPLAY_OPTION.MINIFIED) ||
      (defaultView === 'raw' && option === DISPLAY_OPTION.RAW_STACK_TRACE)
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
    (persistedOptions.includes(DISPLAY_OPTION.RAW_STACK_TRACE) ? 'raw' : defaultView);
  const isMinified =
    hasMinifiedStacktrace && persistedOptions.includes(DISPLAY_OPTION.MINIFIED);
  const setOption = useCallback(
    (option: DisplayOption, enabled: boolean) => {
      // Rebuilt from DISPLAY_OPTION so stored values keep a stable order.
      setPersistedOptions(previous =>
        Object.values(DISPLAY_OPTION).filter(value =>
          value === option ? enabled : previous.includes(value)
        )
      );
    },
    [setPersistedOptions]
  );
  const viewState = useMemo<StackTraceViewState>(
    () => ({
      view,
      setView: nextView => {
        setSelectedView(nextView);
        setOption(DISPLAY_OPTION.RAW_STACK_TRACE, nextView === 'raw');
      },
      isMinified,
      setIsMinified: enabled => setOption(DISPLAY_OPTION.MINIFIED, enabled),
      isNewestFirst,
      setIsNewestFirst,
      hasMinifiedStacktrace,
      platform,
    }),
    [view, isMinified, isNewestFirst, hasMinifiedStacktrace, platform, setOption]
  );
  const displayOptions = useMemo<NativeDisplayOptionsContextValue>(
    () => ({
      absoluteAddresses: persistedOptions.includes(DISPLAY_OPTION.ABSOLUTE_ADDRESSES),
      absoluteFilePaths: persistedOptions.includes(DISPLAY_OPTION.ABSOLUTE_FILE_PATHS),
      setFrameDetail: setOption,
      verboseFunctionNames: persistedOptions.includes(
        DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES
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
