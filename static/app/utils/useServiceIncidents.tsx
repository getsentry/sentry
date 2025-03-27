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
   * Should we include resolved incidents
   */
  includeResolved?: boolean;
}

/**
 * Fetch service incidents from the configured status page.
 *
 * May be filtered to resolved or unresolved incidents (by default fetches all
 * incidents). Fetching unrsolved incidents will use the `unresolved.json`
 * endpoint, efficiently only loading unresolved incidents.
 */
export function useServiceIncidents({
  includeResolved,
  componentFilter,
}: UseServiceIncidentsOptions = {}) {
  const {statuspage} = useLegacyStore(ConfigStore);
  const {api_host, id} = statuspage ?? {};

  return useQuery<StatuspageIncident[] | null>({
    queryKey: ['statuspage-incidents', {api_host, id, includeResolved}],
    gcTime: 60 * 5,
    queryFn: async () => {
      if (!api_host || !id) {
        return null;
      }

      // We can avoid fetching lots of data by only querying the unresolved API
      // when we filter to only unresolved incidents
      const statusPageUrl = includeResolved
        ? `https://${id}.${api_host}/api/v2/incidents.json`
        : `https://${id}.${api_host}/api/v2/incidents/unresolved.json`;

      let resp: Response;
      try {
        resp = await fetch(statusPageUrl);
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

      if (!includeResolved) {
        filteredIncidents = incidents?.filter(inc => inc.status !== 'resolved') ?? null;
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
