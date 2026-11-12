import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

/**
 * Fetches the given monitors in one request, keyed by monitor id.
 * Max per page is 100 - capped by the endpoint.
 */
export function useMonitorsById(ids: Array<string | number>, limit = 100) {
  const organization = useOrganization();
  const monitorIds = [...new Set(ids.map(String))].sort();

  return useQuery({
    ...detectorListApiOptions(organization, {ids: monitorIds, limit}),
    enabled: monitorIds.length > 0,
    select: ({json}) => new Map(json.map(monitor => [monitor.id, monitor])),
    placeholderData: keepPreviousData,
  });
}
