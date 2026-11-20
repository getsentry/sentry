import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isLogsUnsupportedBySDK} from 'sentry/views/explore/replays/detail/ourlogs/unsupportedReplays';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

import {isLogsEnabled} from './isLogsEnabled';

export function hasLogsOnReplays(
  organization: Organization,
  project?: Project | null,
  replay?: ReplayRecord | null
): boolean {
  if (!isLogsEnabled(organization)) {
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
