import type {Organization} from 'sentry/types/organization';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {isLogsUnsupportedBySDK} from 'sentry/views/replays/detail/ourlogs/unsupportedReplays';
import type {ReplayRecord} from 'sentry/views/replays/types';

export function hasLogsOnReplays(
  organization: Organization,
  replay?: ReplayRecord | null
): boolean {
  const hasFeatureFlag =
    isLogsEnabled(organization) && organization.features.includes('ourlogs-replay-ui');

  if (!hasFeatureFlag) {
    return false;
  }

  if (!replay) {
    return false;
  }

  return !isLogsUnsupportedBySDK(replay.sdk?.name);
}
