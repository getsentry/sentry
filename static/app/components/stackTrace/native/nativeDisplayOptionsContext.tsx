import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {
  StackTraceViewStateContext,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import type {
  StackTraceView,
  StackTraceViewState,
  StackTraceViewStateProviderProps,
} from 'sentry/components/stackTrace/types';

import {
  getNativeDisplayOptionDefaults,
  getNativeDisplayOptions,
  NATIVE_DISPLAY_OPTION,
  useNativeDisplayOptionsStorage,
} from './nativeDisplayOptionsPersistence';

interface NativeDisplayOptionsState {
  absoluteAddresses: boolean;
  absoluteFilePaths: boolean;
  isNewestFirst: boolean;
  prefersMinified: boolean;
  verboseFunctionNames: boolean;
  view: StackTraceView;
}

interface NativeDisplayOptionsContextValue {
  absoluteAddresses: boolean;
  absoluteFilePaths: boolean;
  prefersMinified: boolean;
  updateDisplayOptions: (options: NativeDisplayOptionsState) => void;
  verboseFunctionNames: boolean;
}

interface NativeStackTraceViewStateProviderProps extends StackTraceViewStateProviderProps {
  storageKey?: string;
}

type PersistedOptions = ReturnType<typeof getNativeDisplayOptions>;
type SetPersistedOptions = React.Dispatch<React.SetStateAction<PersistedOptions>>;

const NativeDisplayOptionsContext =
  createContext<NativeDisplayOptionsContextValue | null>(null);

export function NativeStackTraceViewStateProvider({
  storageKey,
  ...props
}: NativeStackTraceViewStateProviderProps) {
  if (storageKey) {
    return (
      <PersistedNativeStackTraceViewStateProvider storageKey={storageKey} {...props} />
    );
  }

  return <LocalNativeStackTraceViewStateProvider {...props} />;
}

function PersistedNativeStackTraceViewStateProvider({
  storageKey,
  ...props
}: Omit<NativeStackTraceViewStateProviderProps, 'storageKey'> & {storageKey: string}) {
  const [persistedOptions, setPersistedOptions] =
    useNativeDisplayOptionsStorage(storageKey);

  return (
    <NativeStackTraceViewStateRoot
      key={storageKey}
      persistedOptions={persistedOptions}
      setPersistedOptions={setPersistedOptions}
      {...props}
    />
  );
}

function LocalNativeStackTraceViewStateProvider({
  defaultIsMinified = false,
  defaultView = 'app',
  ...props
}: Omit<NativeStackTraceViewStateProviderProps, 'storageKey'>) {
  const [persistedOptions, setPersistedOptions] = useState<PersistedOptions>(() =>
    getNativeDisplayOptions({
      absoluteAddresses: false,
      absoluteFilePaths: false,
      isMinified: defaultIsMinified,
      verboseFunctionNames: false,
      view: defaultView,
    })
  );

  return (
    <NativeStackTraceViewStateRoot
      {...props}
      defaultIsMinified={defaultIsMinified}
      defaultView={defaultView}
      persistedOptions={persistedOptions}
      setPersistedOptions={setPersistedOptions}
    />
  );
}

function NativeStackTraceViewStateRoot({
  children,
  defaultIsMinified = false,
  defaultView = 'app',
  hasMinifiedStacktrace = false,
  persistedOptions,
  setPersistedOptions,
  defaultIsNewestFirst = true,
  platform,
}: Omit<NativeStackTraceViewStateProviderProps, 'storageKey'> & {
  persistedOptions: PersistedOptions;
  setPersistedOptions: SetPersistedOptions;
}) {
  const defaults = getNativeDisplayOptionDefaults({
    defaultIsMinified,
    defaultView,
    persistedOptions,
  });

  // Keep user choices across threads, but show all frames when app filtering
  // would hide a system-only trace and use raw data only where it is available.
  const [selectedView, setView] = useState<StackTraceView>(() =>
    defaults.defaultView === 'raw' ? 'raw' : 'app'
  );
  const [prefersMinified, setIsMinified] = useState(defaults.defaultIsMinified);
  const [isNewestFirst, setIsNewestFirst] = useState(defaultIsNewestFirst);
  const view = selectedView === 'app' && defaultView === 'full' ? 'full' : selectedView;
  const isMinified = hasMinifiedStacktrace && prefersMinified;
  const value = useMemo<StackTraceViewState>(
    () => ({
      view,
      setView,
      isMinified,
      setIsMinified,
      isNewestFirst,
      setIsNewestFirst,
      hasMinifiedStacktrace,
      platform,
    }),
    [view, isMinified, isNewestFirst, hasMinifiedStacktrace, platform]
  );

  return (
    <StackTraceViewStateContext value={value}>
      <NativeDisplayOptionsProvider
        prefersMinified={prefersMinified}
        persistedOptions={persistedOptions}
        setPersistedOptions={setPersistedOptions}
      >
        {children}
      </NativeDisplayOptionsProvider>
    </StackTraceViewStateContext>
  );
}

function NativeDisplayOptionsProvider({
  children,
  prefersMinified,
  persistedOptions,
  setPersistedOptions,
}: {
  children: React.ReactNode;
  persistedOptions: PersistedOptions;
  prefersMinified: boolean;
  setPersistedOptions: SetPersistedOptions;
}) {
  const {setIsMinified, setIsNewestFirst, setView, view} = useStackTraceViewState();
  const updateDisplayOptions = useCallback(
    (options: NativeDisplayOptionsState) => {
      if (options.view !== view) {
        setView(options.view);
      }
      setIsNewestFirst(options.isNewestFirst);
      setIsMinified(options.prefersMinified);
      setPersistedOptions(
        getNativeDisplayOptions({
          absoluteAddresses: options.absoluteAddresses,
          absoluteFilePaths: options.absoluteFilePaths,
          isMinified: options.prefersMinified,
          verboseFunctionNames: options.verboseFunctionNames,
          view: options.view,
        })
      );
    },
    [setIsMinified, setIsNewestFirst, setPersistedOptions, setView, view]
  );
  const value = useMemo<NativeDisplayOptionsContextValue>(
    () => ({
      absoluteAddresses: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES
      ),
      absoluteFilePaths: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS
      ),
      prefersMinified,
      updateDisplayOptions,
      verboseFunctionNames: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES
      ),
    }),
    [prefersMinified, persistedOptions, updateDisplayOptions]
  );

  return (
    <NativeDisplayOptionsContext value={value}>{children}</NativeDisplayOptionsContext>
  );
}

export function useNativeDisplayOptionsContext() {
  const context = useContext(NativeDisplayOptionsContext);
  if (!context) {
    throw new Error(
      'useNativeDisplayOptionsContext must be used within NativeStackTraceViewStateProvider'
    );
  }
  return context;
}
