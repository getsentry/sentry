import {useState} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import {Token} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import type {PageFilters} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
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
 * Returns [invalidFilterKeys, validateKeys] where validateKeys
 * should be called with a parsed query (e.g. from onChange).
 */
export function useAsyncAttributeValidation(
  itemType: TraceItemDataset,
  projects?: PageFilters['projects']
): [string[], (parsedQuery: ParseResult | null) => void] {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const effectiveProjects = projects ?? selection.projects;
  const [invalidFilterKeys, setInvalidFilterKeys] =
    useState<string[]>(EMPTY_INVALID_KEYS);

  const {mutate} = useMutation<
    ValidateAttributesResponse,
    RequestError,
    ParseResult | null
  >({
    mutationFn: (parsedQuery: ParseResult | null) => {
      if (!parsedQuery) {
        return Promise.resolve({attributes: {}} as ValidateAttributesResponse);
      }

      const keySet = new Set<string>();
      if (parsedQuery) {
        for (const token of parsedQuery) {
          if (token.type === Token.FILTER) {
            keySet.add(getKeyName(token.key));
          }
        }
      }

      if (keySet.size === 0) {
        return Promise.resolve({attributes: {}} as ValidateAttributesResponse);
      }

      const queryParams = {
        ...Object.fromEntries(
          Object.entries(normalizeDateTimeParams(selection.datetime)).filter(
            (entry): entry is [string, string | string[]] => entry[1] !== null
          )
        ),
        ...(effectiveProjects?.length ? {project: effectiveProjects.map(String)} : {}),
      };

      return fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/trace-items/attributes/validate/',
          {path: {organizationIdOrSlug: organization.slug}}
        ),
        data: {itemType, attributes: [...keySet]},
        method: 'POST',
        options: {query: queryParams},
      });
    },
    onSuccess: response => {
      const invalid = Object.entries(response.attributes)
        .filter(([_key, result]) => !result.valid)
        .map(([key]) => key);
      setInvalidFilterKeys(invalid.length > 0 ? invalid : EMPTY_INVALID_KEYS);
    },
    onError: () => {
      // Fail-open: clear invalid keys on error
      setInvalidFilterKeys(EMPTY_INVALID_KEYS);
    },
  });

  return [invalidFilterKeys, mutate];
}
