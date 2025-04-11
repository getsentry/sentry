import {useCallback} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useStarredTransactions() {
  const organization = useOrganization();
  const api = useApi();

  const starTransaction = useCallback(
    (segmentName: string, projectId: string) =>
      api.requestPromise(
        `/organizations/${organization.slug}/insights/starred-segments/`,
        {
          method: 'POST',
          data: {
            project_id: projectId,
            segment_name: segmentName,
          },
        }
      ),
    [api, organization.slug]
  );

  const unstarTransaction = useCallback(
    (segmentName: string, projectId: string) =>
      api.requestPromise(
        `/organizations/${organization.slug}/insights/starred-segments/`,
        {
          method: 'DELETE',
          data: {
            project_id: projectId,
            segment_name: segmentName,
          },
        }
      ),
    [api, organization.slug]
  );

  return {starTransaction, unstarTransaction};
}
