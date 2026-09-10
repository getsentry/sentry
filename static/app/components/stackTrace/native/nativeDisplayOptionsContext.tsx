import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {StackTraceViewStateContext} from 'sentry/components/stackTrace/stackTraceContext';
import type {
  StackTraceView,
  StackTraceViewState,
  StackTraceViewStateProviderProps,
} from 'sentry/components/stackTrace/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

import {
  getNativeDisplayOptions,
  NATIVE_DISPLAY_OPTION,
  type NativePersistedDisplayOption,
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

type PersistedOptions = NativePersistedDisplayOption[];
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
  const [persistedOptions, setPersistedOptions] = useLocalStorageState<PersistedOptions>(
    storageKey,
    []
  );

  return (
    <NativeStackTraceViewStateRoot
      key={storageKey}
      persistedOptions={persistedOptions}
      setPersistedOptions={setPersistedOptions}
      {...props}
    />
  );
}

function LocalNativeStackTraceViewStateProvider(
  props: Omit<NativeStackTraceViewStateProviderProps, 'storageKey'>
) {
  const [persistedOptions, setPersistedOptions] = useState<PersistedOptions>([]);

  return (
    <NativeStackTraceViewStateRoot
      {...props}
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
  // Preferences survive thread changes; effective settings depend on available data.
  const [selectedView, setView] = useState<StackTraceView | null>(() =>
    defaultView === 'raw' ||
    persistedOptions.includes(NATIVE_DISPLAY_OPTION.RAW_STACK_TRACE)
      ? 'raw'
      : null
  );
  const [prefersMinified, setIsMinified] = useState(
    () => defaultIsMinified || persistedOptions.includes(NATIVE_DISPLAY_OPTION.MINIFIED)
  );
  const [isNewestFirst, setIsNewestFirst] = useState(defaultIsNewestFirst);
  const view = selectedView ?? defaultView;

  useEffect(() => {
    setPersistedOptions(previous => {
      const next = getNativeDisplayOptions({
        absoluteAddresses: previous.includes(NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES),
        absoluteFilePaths: previous.includes(NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS),
        verboseFunctionNames: previous.includes(
          NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES
        ),
        isMinified: prefersMinified,
        view,
      });
      return next.length === previous.length &&
        next.every((option, index) => option === previous[index])
        ? previous
        : next;
    });
  }, [prefersMinified, setPersistedOptions, view]);
  const isMinified = hasMinifiedStacktrace && prefersMinified;
  const viewState = useMemo<StackTraceViewState>(
    () => ({
      view,
      setView: update =>
        setView(previous =>
          typeof update === 'function' ? update(previous ?? defaultView) : update
        ),
      isMinified,
      setIsMinified,
      isNewestFirst,
      setIsNewestFirst,
      hasMinifiedStacktrace,
      platform,
    }),
    [view, isMinified, isNewestFirst, hasMinifiedStacktrace, platform, defaultView]
  );

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
  const displayOptions = useMemo<NativeDisplayOptionsContextValue>(
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
      'useNativeDisplayOptionsContext must be used within NativeStackTraceViewStateProvider'
    );
  }
  return context;
}
