import type {Organization} from 'sentry/types/organization';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';

export function hasLogsOnReplays(organization: Organization): boolean {
  return (
    isLogsEnabled(organization) && organization.features.includes('ourlogs-replay-ui')
  );
}
