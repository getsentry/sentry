import React from 'react';

import {
  ParseResult,
  parseSearch,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {AggregationKey, FieldKey, getFieldDefinition} from 'sentry/utils/fields';
import {
  ON_DEMAND_METRICS_UNSUPPORTED_TAGS,
  STANDARD_SEARCH_FIELD_KEYS,
} from 'sentry/utils/onDemandMetrics/constants';

function isStandardSearchFilterKey(key: string): boolean {
  return STANDARD_SEARCH_FIELD_KEYS.has(key as FieldKey);
}

function isOnDemandSupportedFilterKey(key: string): boolean {
  return !ON_DEMAND_METRICS_UNSUPPORTED_TAGS.has(key as FieldKey);
}

function isCustomTag(key: string): boolean {
  return !getFieldDefinition(key);
}

export function createOnDemandFilterWarning(warning: React.ReactNode) {
  return (key: string) => {
    const fieldKey = key as FieldKey;
    if (isCustomTag(fieldKey)) {
      return warning;
    }
    if (!isStandardSearchFilterKey(fieldKey) && isOnDemandSupportedFilterKey(fieldKey)) {
      return warning;
    }
    return null;
  };
}

export function isOnDemandAggregate(aggregate: string): boolean {
  return aggregate.includes(AggregationKey.APDEX);
}

export function isOnDemandQueryString(query: string): boolean {
  const searchFilterKeys = getSearchFilterKeys(query);
  const isStandardSearch = searchFilterKeys.every(isStandardSearchFilterKey);
  const isOnDemandSupportedSearch = searchFilterKeys.some(isOnDemandSupportedFilterKey);
  const hasCustomTags = searchFilterKeys.some(isCustomTag);

  return !isStandardSearch && (isOnDemandSupportedSearch || hasCustomTags);
}

export function isOnDemandSearchKey(searchKey: string): boolean {
  return (
    !isStandardSearchFilterKey(searchKey) &&
    (isOnDemandSupportedFilterKey(searchKey) || isCustomTag(searchKey))
  );
}

type SearchFilter = {key: string; operator: string; value: string};

function getSearchFilterKeys(query: string): string[] {
  try {
    return getSearchFilters(query).map(({key}) => key);
  } catch (e) {
    return [];
  }
}

export function getSearchFilters(query: string): SearchFilter[] {
  try {
    const tokens = parseSearch(query);
    if (!tokens) {
      return [];
    }

    return getSearchFiltersFromTokens(tokens);
  } catch (e) {
    return [];
  }
}

function getSearchFiltersFromTokens(tokens: ParseResult): SearchFilter[] {
  return tokens.flatMap(getTokenKeyValuePair).filter(Boolean) as SearchFilter[];
}

function getTokenKeyValuePair(
  token: TokenResult<Token>
): SearchFilter[] | SearchFilter | null {
  if (token.type === Token.LOGIC_GROUP) {
    return getSearchFiltersFromTokens(token.inner);
  }
  if (token.type === Token.FILTER) {
    return {key: token.key.text, operator: token.operator, value: token.value.text};
  }

  return null;
}

export function getOnDemandKeys(query: string): string[] {
  const searchFilterKeys = getSearchFilterKeys(query);
  return searchFilterKeys.filter(isOnDemandSearchKey);
}
