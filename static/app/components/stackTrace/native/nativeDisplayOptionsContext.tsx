import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {
  StackTraceViewStateProvider,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import type {
  StackTraceView,
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
  ...viewStateProps
}: Omit<NativeStackTraceViewStateProviderProps, 'storageKey'> & {
  persistedOptions: PersistedOptions;
  setPersistedOptions: SetPersistedOptions;
}) {
  const defaults = getNativeDisplayOptionDefaults({
    defaultIsMinified,
    defaultView,
    hasMinifiedStacktrace,
    persistedOptions,
  });

  return (
    <StackTraceViewStateProvider
      {...viewStateProps}
      defaultIsMinified={defaults.defaultIsMinified}
      defaultView={defaults.defaultView}
      hasMinifiedStacktrace={hasMinifiedStacktrace}
    >
      <NativeDisplayOptionsProvider
        persistedOptions={persistedOptions}
        setPersistedOptions={setPersistedOptions}
      >
        {children}
      </NativeDisplayOptionsProvider>
    </StackTraceViewStateProvider>
  );
}

function NativeDisplayOptionsProvider({
  children,
  persistedOptions,
  setPersistedOptions,
}: {
  children: React.ReactNode;
  persistedOptions: PersistedOptions;
  setPersistedOptions: SetPersistedOptions;
}) {
  const {hasMinifiedStacktrace, isMinified, setIsMinified, setIsNewestFirst, setView} =
    useStackTraceViewState();
  const updateDisplayOptions = useCallback(
    (options: NativeDisplayOptionsState) => {
      setView(options.view);
      setIsNewestFirst(options.isNewestFirst);
      setIsMinified(hasMinifiedStacktrace && options.prefersMinified);
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
    [hasMinifiedStacktrace, setIsMinified, setIsNewestFirst, setPersistedOptions, setView]
  );
  const value = useMemo<NativeDisplayOptionsContextValue>(
    () => ({
      absoluteAddresses: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES
      ),
      absoluteFilePaths: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS
      ),
      prefersMinified:
        isMinified || persistedOptions.includes(NATIVE_DISPLAY_OPTION.MINIFIED),
      updateDisplayOptions,
      verboseFunctionNames: persistedOptions.includes(
        NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES
      ),
    }),
    [isMinified, persistedOptions, updateDisplayOptions]
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
