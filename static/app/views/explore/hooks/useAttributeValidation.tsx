import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import {Token} from 'sentry/components/searchSyntax/parser';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import type {PageFilters} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
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

const EMPTY_KEYS: string[] = [];

function extractFilterKeys(parsedQuery: ParseResult | null): string[] {
  if (!parsedQuery) {
    return EMPTY_KEYS;
  }
  const keySet = new Set<string>();
  function walk(tokens: ParseResult) {
    for (const token of tokens) {
      if (token.type === Token.FILTER) {
        keySet.add(getKeyName(token.key));
      } else if (token.type === Token.LOGIC_GROUP) {
        walk(token.inner);
      }
    }
  }
  walk(parsedQuery);
  return keySet.size > 0 ? [...keySet].sort() : EMPTY_KEYS;
}

export function useAttributeValidation(
  itemType: TraceItemDataset,
  query: string,
  selection: AttributeValidationSelection
): {
  invalidFilterKeys: string[];
} {
  const organization = useOrganization();
  const hasValidation = organization.features.includes(
    'search-query-attribute-validation'
  );

  const filterKeys = useMemo(
    () => (hasValidation ? extractFilterKeys(parseSearch(query)) : EMPTY_KEYS),
    [hasValidation, query]
  );

  const {data} = useQuery({
    ...apiOptions.as<ValidateAttributesResponse>()(
      '/organizations/$organizationIdOrSlug/trace-items/attributes/validate/',
      {
        path: {organizationIdOrSlug: organization.slug},
        method: 'POST',
        data: {attributes: filterKeys},
        query: {
          itemType,
          ...Object.fromEntries(
            Object.entries(normalizeDateTimeParams(selection.datetime)).filter(
              (entry): entry is [string, string | string[]] => entry[1] !== null
            )
          ),
          ...(selection.projects?.length
            ? {project: selection.projects.map(String)}
            : {}),
        },
        staleTime: Infinity,
      }
    ),
    enabled: hasValidation && filterKeys.length > 0,
  });

  const invalidFilterKeys = useMemo(() => {
    if (!data || !hasValidation) {
      return EMPTY_KEYS;
    }

    return Object.entries(data.attributes ?? {})
      .filter(([, result]) => !result.valid)
      .map(([key]) => key);
  }, [data, hasValidation]);

  return {invalidFilterKeys};
}
