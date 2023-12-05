import {Client} from 'sentry/api';
import {Organization} from 'sentry/types';

import {ThresholdStatus, ThresholdStatusesQuery} from './types';

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
