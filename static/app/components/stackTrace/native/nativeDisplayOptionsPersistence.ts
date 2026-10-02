export const NATIVE_DISPLAY_OPTION = {
  ABSOLUTE_ADDRESSES: 'absolute-addresses',
  ABSOLUTE_FILE_PATHS: 'absolute-file-paths',
  MINIFIED: 'minified',
  RAW_STACK_TRACE: 'raw-stack-trace',
  VERBOSE_FUNCTION_NAMES: 'verbose-function-names',
} as const;

export type NativePersistedDisplayOption =
  (typeof NATIVE_DISPLAY_OPTION)[keyof typeof NATIVE_DISPLAY_OPTION];

export function updateNativeDisplayOption(
  options: NativePersistedDisplayOption[],
  option: NativePersistedDisplayOption,
  enabled: boolean
): NativePersistedDisplayOption[] {
  return Object.values(NATIVE_DISPLAY_OPTION).filter(value =>
    value === option ? enabled : options.includes(value)
  );
}
