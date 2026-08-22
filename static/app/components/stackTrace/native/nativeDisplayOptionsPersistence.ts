import type {StackTraceView} from 'sentry/components/stackTrace/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export const NATIVE_DISPLAY_OPTION = {
  ABSOLUTE_ADDRESSES: 'absolute-addresses',
  ABSOLUTE_FILE_PATHS: 'absolute-file-paths',
  MINIFIED: 'minified',
  RAW_STACK_TRACE: 'raw-stack-trace',
  VERBOSE_FUNCTION_NAMES: 'verbose-function-names',
} as const;

type NativePersistedDisplayOption =
  (typeof NATIVE_DISPLAY_OPTION)[keyof typeof NATIVE_DISPLAY_OPTION];

export function useNativeDisplayOptionsStorage(storageKey: string) {
  return useLocalStorageState<NativePersistedDisplayOption[]>(storageKey, []);
}

export function getNativeDisplayOptionDefaults({
  defaultIsMinified = false,
  defaultView = 'app',
  hasMinifiedStacktrace,
  persistedOptions,
}: {
  hasMinifiedStacktrace: boolean;
  persistedOptions: NativePersistedDisplayOption[];
  defaultIsMinified?: boolean;
  defaultView?: StackTraceView;
}) {
  return {
    defaultAbsoluteAddresses: persistedOptions.includes(
      NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES
    ),
    defaultAbsoluteFilePaths: persistedOptions.includes(
      NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS
    ),
    defaultIsMinified:
      hasMinifiedStacktrace &&
      (defaultIsMinified || persistedOptions.includes(NATIVE_DISPLAY_OPTION.MINIFIED)),
    defaultVerboseFunctionNames: persistedOptions.includes(
      NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES
    ),
    defaultView: persistedOptions.includes(NATIVE_DISPLAY_OPTION.RAW_STACK_TRACE)
      ? ('raw' as const)
      : defaultView,
  };
}

export function getNativeDisplayOptions({
  absoluteAddresses,
  absoluteFilePaths,
  isMinified,
  verboseFunctionNames,
  view,
}: {
  absoluteAddresses: boolean;
  absoluteFilePaths: boolean;
  isMinified: boolean;
  verboseFunctionNames: boolean;
  view: StackTraceView;
}): NativePersistedDisplayOption[] {
  const nextOptions: NativePersistedDisplayOption[] = [];

  if (absoluteAddresses) {
    nextOptions.push(NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES);
  }
  if (absoluteFilePaths) {
    nextOptions.push(NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS);
  }
  if (isMinified) {
    nextOptions.push(NATIVE_DISPLAY_OPTION.MINIFIED);
  }
  if (view === 'raw') {
    nextOptions.push(NATIVE_DISPLAY_OPTION.RAW_STACK_TRACE);
  }
  if (verboseFunctionNames) {
    nextOptions.push(NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES);
  }

  return nextOptions;
}
