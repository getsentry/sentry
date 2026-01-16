import {useCallback} from 'react';

import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {FieldKind, getFieldDefinition} from './index';

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

/**
 * Type definition for getFieldDefinition type parameter.
 */
export type FieldDefinitionType =
  | 'event'
  | 'replay'
  | 'replay_click'
  | 'feedback'
  | 'span'
  | 'log'
  | 'uptime'
  | 'tracemetric';

/**
 * React hook that provides a getter function for field definitions.
 * The getter uses attribute mappings to enhance field definitions with ATTRIBUTE_METADATA.
 *
 * If the API request fails or is pending, the getter falls back to the base
 * getFieldDefinition without mappings enhancement.
 *
 * @returns Object containing the getter function and loading/error states
 */
export function useFieldDefinitionGetter(): {
  getFieldDefinition: FieldDefinitionGetter;
  isError: boolean;
  isPending: boolean;
} {
  const {data, isPending, isError} = useAttributeMappings();

  const getter: FieldDefinitionGetter = useCallback(
    (key: string, type: FieldDefinitionType = 'event', kind?: FieldKind) => {
      return getFieldDefinition(key, type, {kind, mappings: data?.data});
    },
    [data?.data]
  );

  return {
    getFieldDefinition: getter,
    isPending,
    isError,
  };
}
