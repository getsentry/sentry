import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import {Token} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import type {PageFilters} from 'sentry/types/core';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

interface AttributeValidationResult {
  valid: boolean;
  error?: string;
  type?: 'boolean' | 'number' | 'string';
}

interface ValidateAttributesResponse {
  attributes: Record<string, AttributeValidationResult>;
}

const EMPTY_INVALID_KEYS: string[] = [];
const EMPTY_KEYS: string[] = [];

/**
 * Extracts and sorts unique filter key names from a parsed search query.
 * Sorting ensures stable query keys regardless of token order.
 */
export function extractFilterKeys(parsedQuery: ParseResult | null): string[] {
  if (!parsedQuery) {
    return EMPTY_KEYS;
  }
  const keySet = new Set<string>();
  for (const token of parsedQuery) {
    if (token.type === Token.FILTER) {
      keySet.add(getKeyName(token.key));
    }
  }
  return keySet.size > 0 ? [...keySet].sort() : EMPTY_KEYS;
}

/**
 * Hook that validates trace item filter keys against the API.
 * Accepts filter keys declaratively and returns invalid key names.
 * Uses useApiQuery for automatic deduplication, caching, and
 * stale response handling.
 */
export function useAttributeValidation(
  itemType: TraceItemDataset,
  filterKeys: string[],
  projects?: PageFilters['projects']
): string[] {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const effectiveProjects = projects ?? selection.projects;

  const queryKey: ApiQueryKey = useMemo(
    () => [
      getApiUrl('/organizations/$organizationIdOrSlug/trace-items/attributes/validate/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        method: 'POST' as const,
        data: {itemType, attributes: filterKeys},
        query: {
          ...Object.fromEntries(
            Object.entries(normalizeDateTimeParams(selection.datetime)).filter(
              (entry): entry is [string, string | string[]] => entry[1] !== null
            )
          ),
          ...(effectiveProjects?.length ? {project: effectiveProjects.map(String)} : {}),
        },
      },
    ],
    [organization.slug, itemType, filterKeys, selection.datetime, effectiveProjects]
  );

  const {data} = useApiQuery<ValidateAttributesResponse>(queryKey, {
    staleTime: 0,
    enabled: filterKeys.length > 0,
    placeholderData: keepPreviousData,
  });

  return useMemo(() => {
    if (!data) {
      return EMPTY_INVALID_KEYS;
    }
    const invalid = Object.entries(data.attributes)
      .filter(([_key, result]) => !result.valid)
      .map(([key]) => key);
    return invalid.length > 0 ? invalid : EMPTY_INVALID_KEYS;
  }, [data]);
}
