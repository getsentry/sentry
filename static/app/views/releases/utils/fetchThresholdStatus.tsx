import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types';

import type {ThresholdStatus, ThresholdStatusesQuery} from './types';

export function fetchThresholdStatuses(
  organization: Organization,
  api: Client,
  query: ThresholdStatusesQuery
): Promise<{[key: string]: ThresholdStatus[]}> {
  return api.requestPromise(
    `/organizations/${organization.slug}/release-threshold-statuses/`,
    {
      method: 'GET',
      query,
    }
  );
}
