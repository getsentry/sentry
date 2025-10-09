/**
 * SDKs that do not yet support logs in replay
 */
const UNSUPPORTED_REPLAY_LOGS_SDK_NAMES = [
  'sentry.cocoa',
  'sentry.java.android',
  'sentry.cocoa.flutter',
  'sentry.dart.flutter',
  'sentry.java.android.flutter',
] as const;

type UnsupportedSDKName = (typeof UNSUPPORTED_REPLAY_LOGS_SDK_NAMES)[number];

export function isLogsUnsupportedBySDK(sdkName: string | null | undefined): boolean {
  if (!sdkName) {
    return true;
  }
  return UNSUPPORTED_REPLAY_LOGS_SDK_NAMES.includes(sdkName as UnsupportedSDKName);
}
