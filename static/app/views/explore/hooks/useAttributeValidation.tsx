import {useCallback, useState} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import {Token} from 'sentry/components/searchSyntax/parser';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import type {PageFilters} from 'sentry/types/core';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, queryOptions, useQueryClient} from 'sentry/utils/queryClient';
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

export interface AttributeValidationSelection {
  datetime: PageFilters['datetime'];
  projects?: PageFilters['projects'];
}

interface ValidateAttributesParams extends AttributeValidationSelection {
  filterKeys: string[];
  itemType: TraceItemDataset;
  organizationSlug: string;
}

const EMPTY_KEYS: string[] = [];

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

function validateAttributesQueryOptions({
  itemType,
  filterKeys,
  organizationSlug,
  datetime,
  projects,
}: ValidateAttributesParams) {
  return queryOptions({
    queryKey: [
      getApiUrl('/organizations/$organizationIdOrSlug/trace-items/attributes/validate/', {
        path: {organizationIdOrSlug: organizationSlug},
      }),
      {
        method: 'POST' as const,
        data: {itemType, attributes: filterKeys},
        query: {
          ...Object.fromEntries(
            Object.entries(normalizeDateTimeParams(datetime)).filter(
              (entry): entry is [string, string | string[]] => entry[1] !== null
            )
          ),
          ...(projects?.length ? {project: projects.map(String)} : {}),
        },
      },
    ] satisfies ApiQueryKey,
    queryFn: fetchDataQuery<ValidateAttributesResponse>,
    staleTime: Infinity,
    enabled: filterKeys.length > 0,
  });
}

export function useAttributeValidation(itemType: TraceItemDataset): {
  invalidFilterKeys: string[];
  validateQuery: (
    query: string,
    selection: AttributeValidationSelection
  ) => Promise<void>;
} {
  const [invalidFilterKeys, setInvalidFilterKeys] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const validateQuery = useCallback(
    async (query: string, selection: AttributeValidationSelection) => {
      const keys = extractFilterKeys(parseSearch(query));
      if (!keys.length) {
        setInvalidFilterKeys([]);
        return;
      }
      try {
        const options = validateAttributesQueryOptions({
          itemType,
          filterKeys: keys,
          organizationSlug: organization.slug,
          ...selection,
        });
        await queryClient.cancelQueries({queryKey: [options.queryKey[0]]});
        const [data] = await queryClient.fetchQuery(options);
        setInvalidFilterKeys(
          Object.entries(data.attributes)
            .filter(([, result]) => !result.valid)
            .map(([key]) => key)
        );
      } catch {
        // leave previous state on error
      }
    },
    [queryClient, organization.slug, itemType]
  );

  return {invalidFilterKeys, validateQuery};
}
