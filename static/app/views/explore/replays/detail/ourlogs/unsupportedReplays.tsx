import {semverCompare} from 'sentry/utils/versions/semverCompare';

export function isLogsUnsupportedBySDK(
  sdkName: string | null | undefined,
  sdkVersion?: string | null
): boolean {
  if (!sdkName) {
    return true;
  }
  if (sdkName === 'sentry.cocoa') {
    // Cocoa attaches replay IDs to logs starting with 9.0.0-alpha.0.
    return !sdkVersion || semverCompare(sdkVersion, '9.0.0-alpha.0') < 0;
  }
  return false;
}
