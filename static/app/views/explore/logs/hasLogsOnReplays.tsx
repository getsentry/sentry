import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {isLogsUnsupportedBySDK} from 'sentry/views/replays/detail/ourlogs/unsupportedReplays';
import type {ReplayRecord} from 'sentry/views/replays/types';

export function hasLogsOnReplays(
  organization: Organization,
  project?: Project | null,
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

  if (!project?.hasLogs) {
    return false;
  }

  return !isLogsUnsupportedBySDK(replay.sdk?.name);
}
