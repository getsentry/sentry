import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {StatusPageComponent, StatuspageIncident} from 'sentry/types/system';
import {useQuery} from 'sentry/utils/queryClient';

interface UseServiceIncidentsOptions {
  /**
   * Filter incidents to specific components
   */
  componentFilter?: StatusPageComponent[];
  /**
   * Should we load all incidents or just unresolved incidents
   */
  statusFilter?: 'unresolved' | 'resolved';
}

/**
 * Fetch service incidents from the configured status page.
 *
 * May be filtered to resolved or unresolved incidents (by default fetches all
 * incidents). Fetching unrsolved incidents will use the `unresolved.json`
 * endpoint, efficiently only loading unresolved incidents.
 */
export function useServiceIncidents({
  statusFilter,
  componentFilter,
}: UseServiceIncidentsOptions = {}) {
  const {statuspage} = useLegacyStore(ConfigStore);

  return useQuery<StatuspageIncident[] | null>({
    queryKey: ['statuspage-incidents', statusFilter],
    gcTime: 60 * 5,
    queryFn: async () => {
      const {api_host, id} = statuspage ?? {};

      if (!api_host || !id) {
        return null;
      }

      // We can avoid fetching lots of data by only querying the unresolved API
      // when we filter to only unresolvedf incidents
      const sttusPageUrl =
        statusFilter === 'unresolved'
          ? `https://${id}.${api_host}/api/v2/incidents/unresolved.json`
          : `https://${id}.${api_host}/api/v2/incidents.json`;

      let resp: Response;
      try {
        resp = await fetch(sttusPageUrl);
      } catch {
        // No point in capturing this as we can't make statuspage come back.
        return null;
      }

      // Sometimes statuspage responds with a 500
      if (!resp.ok) {
        return null;
      }

      const data = await resp.json();

      return data?.incidents ?? null;
    },
    select: incidents => {
      let filteredIncidents = incidents;

      if (statusFilter) {
        filteredIncidents = incidents?.filter(inc => inc.status === statusFilter) ?? null;
      }
      if (componentFilter) {
        filteredIncidents =
          incidents?.filter(inc =>
            inc.components.some(comp => componentFilter.includes(comp.id))
          ) ?? null;
      }

      return filteredIncidents;
    },
  });
}
