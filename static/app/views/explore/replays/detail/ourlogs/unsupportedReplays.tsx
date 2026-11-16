import {semverCompare} from 'sentry/utils/versions/semverCompare';

/**
 * SDKs that do not yet support logs in replay, with the version that added
 * support. SDKs listed here are unsupported until they reach that version.
 */
const REPLAY_LOGS_SUPPORTED_SINCE_VERSION: Record<string, string> = {
  // sentry-cocoa#6515 added the `sentry.replay_id` log attribute, shipped in
  // 9.0.0. Older releases cannot link logs to a replay.
  'sentry.cocoa': '9.0.0',
};

export function isLogsUnsupportedBySDK(
  sdkName: string | null | undefined,
  sdkVersion: string | null | undefined
): boolean {
  if (!sdkName) {
    return true;
  }

  const supportedSince = REPLAY_LOGS_SUPPORTED_SINCE_VERSION[sdkName];
  if (supportedSince === undefined) {
    return false;
  }

  if (!sdkVersion) {
    return true;
  }

  return semverCompare(sdkVersion, supportedSince) < 0;
}
