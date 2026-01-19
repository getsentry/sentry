import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Represents a single attribute mapping from the /attribute-mappings API.
 * Maps public field names to internal names used by the backend.
 */
export type AttributeMapping = {
  internalName: string;
  publicAlias: string;
  searchType: string;
  type: string;
};

/**
 * Response type for the /attribute-mappings API endpoint.
 */
export type AttributeMappingsResponse = {
  data: AttributeMapping[];
};

/**
 * React hook to fetch and cache attribute mappings from the API.
 * Mappings are cached with staleTime: Infinity since they change infrequently.
 *
 * @param options - Optional configuration
 * @param options.type - Filter mappings by type (e.g., "spans", "logs")
 * @returns The query result with attribute mappings data
 */
export function useAttributeMappings(options?: {type?: string}) {
  const organization = useOrganization();

  const query: Record<string, string> = {};
  if (options?.type) {
    query.type = options.type;
  }

  return useApiQuery<AttributeMappingsResponse>(
    [`/organizations/${organization.slug}/attribute-mappings/`, {query}],
    {
      staleTime: Infinity,
    }
  );
}
