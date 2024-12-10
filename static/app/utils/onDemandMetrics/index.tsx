import type React from 'react';

import type {ParseResult, TokenResult} from 'sentry/components/searchSyntax/parser';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import type {Organization} from 'sentry/types/organization';
import {
  AggregationKey,
  type ErrorTags,
  FieldKey,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {
  ERROR_ONLY_TAGS,
  ON_DEMAND_METRICS_UNSUPPORTED_TAGS,
  STANDARD_SEARCH_FIELD_KEYS,
} from 'sentry/utils/onDemandMetrics/constants';
import {type WidgetQuery, WidgetType} from 'sentry/views/dashboards/types';

import {hasOnDemandMetricWidgetFeature} from './features';

function isStandardSearchFilterKey(key: string): boolean {
  return STANDARD_SEARCH_FIELD_KEYS.has(key as FieldKey);
}

function isOnDemandSupportedFilterKey(key: string): boolean {
  return !ON_DEMAND_METRICS_UNSUPPORTED_TAGS.has(key as FieldKey);
}

function isErrorFilterKey(key: string): boolean {
  return ERROR_ONLY_TAGS.has(key as ErrorTags);
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

function hasErrorCondition(condition: string) {
  // This explicitly checks for error conditions and does not display any on-demand.
  const searchFilterKeys = getSearchFilterKeys(condition);
  const conditionTokens = parseSearch(condition);
  const hasFreeText = conditionTokens?.some(token => token.type === Token.FREE_TEXT);
  const hasErrorTags = searchFilterKeys.some(isErrorFilterKey);
  const hasExplicitErrorType = conditionTokens?.some(token =>
    token.type === Token.FILTER
      ? token.key.text === FieldKey.EVENT_TYPE && token.value.text === 'error'
      : false
  );

  if (hasFreeText || hasErrorTags || hasExplicitErrorType) {
    return true;
  }

  return false;
}

export function shouldDisplayOnDemandWidgetWarning(
  query: WidgetQuery,
  widgetType: WidgetType,
  organization: Organization
) {
  return (
    !hasErrorCondition(query.conditions) &&
    isOnDemandQueryString(query.conditions) &&
    hasOnDemandMetricWidgetFeature(organization) &&
    (widgetType === WidgetType.DISCOVER || widgetType === WidgetType.TRANSACTIONS)
  );
}

export function isOnDemandQueryString(query: string): boolean {
  const searchFilterKeys = getSearchFilterKeys(query);
  const queryTokens = parseSearch(query);

  // Free text is almost exclusively used in the errors side of the discover dataset.
  // It's possible free text is intended to be a transaction, but until we split the discover dataset it's impossible to determine.
  // We err towards not sending on-demand for free text since the free-text for errors is more prevalent.
  const hasFreeText = queryTokens?.some(token => token.type === Token.FREE_TEXT);

  const isStandardSearch = searchFilterKeys.every(isStandardSearchFilterKey);
  const isOnDemandSupportedSearch = searchFilterKeys.some(isOnDemandSupportedFilterKey);
  const hasCustomTags = searchFilterKeys.some(isCustomTag);

  return (
    !hasFreeText && !isStandardSearch && (isOnDemandSupportedSearch || hasCustomTags)
  );
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
