import {ParseResult, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {AggregationKey, FieldKey} from 'sentry/utils/fields';

export function isValidOnDemandMetricAlert(aggregate: string, query: string): boolean {
  if (!isOnDemandMetricAlert(query)) {
    return true;
  }

  const unsupportedAggregates = [
    AggregationKey.PERCENTILE,
    AggregationKey.APDEX,
    AggregationKey.FAILURE_RATE,
  ];

  return !unsupportedAggregates.some(agg => aggregate.includes(agg));
}

const STANDARD_SEARCH_FIELD_KEYS = new Set([
  FieldKey.RELEASE,
  FieldKey.DIST,
  FieldKey.ENVIRONMENT,
  FieldKey.TRANSACTION,
  FieldKey.PLATFORM,
  FieldKey.TRANSACTION_OP,
  FieldKey.TRANSACTION_STATUS,
  FieldKey.HTTP_METHOD,
  FieldKey.HTTP_STATUS_CODE,
  FieldKey.BROWSER_NAME,
  FieldKey.OS_NAME,
  FieldKey.GEO_COUNTRY_CODE,
]);

/**
 * We determine that an alert is an on-demand metric alert if the query contains
 * one of the tags that are supported for on-demand metrics
 */
export function isOnDemandMetricAlert(query: string): boolean {
  const tokens = parseSearch(query);
  if (!tokens) {
    return false;
  }

  const searchFilterKeys = getSearchFilterKeys(tokens);
  return searchFilterKeys.some(key => !STANDARD_SEARCH_FIELD_KEYS.has(key));
}

type SearchFilterKey = FieldKey | null;

function getSearchFilterKeys(tokens: ParseResult): FieldKey[] {
  try {
    return getTokenKeys(tokens).filter(Boolean) as FieldKey[];
  } catch (e) {
    return [];
  }
}

function getTokenKeys(tokens: ParseResult): SearchFilterKey[] {
  return tokens.flatMap(getTokenKey);
}

function getTokenKey(token): SearchFilterKey[] | SearchFilterKey {
  if (token.type === Token.LOGIC_GROUP) {
    return getTokenKeys(token.inner);
  }
  if (token.type === Token.FILTER) {
    return token.key.value;
  }

  return null;
}
