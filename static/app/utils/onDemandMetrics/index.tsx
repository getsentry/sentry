import {ParseResult, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {Organization} from 'sentry/types';
import {FieldKey, getFieldDefinition} from 'sentry/utils/fields';
import {
  ON_DEMAND_METRICS_SUPPORTED_TAGS,
  STANDARD_SEARCH_FIELD_KEYS,
} from 'sentry/utils/onDemandMetrics/constants';

function isStandardSearchFilterKey(key: FieldKey): boolean {
  return STANDARD_SEARCH_FIELD_KEYS.has(key);
}

function isOnDemandSupportedFilterKey(key: FieldKey): boolean {
  return ON_DEMAND_METRICS_SUPPORTED_TAGS.has(key);
}

function isCustomTag(key: FieldKey): boolean {
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

export function isOnDemandQueryString(query: string): boolean {
  const tokens = parseSearch(query);
  if (!tokens) {
    return false;
  }

  const searchFilterKeys = getSearchFilterKeys(tokens);
  const isStandardSearch = searchFilterKeys.every(isStandardSearchFilterKey);
  const isOnDemandSupportedSearch = searchFilterKeys.some(key =>
    ON_DEMAND_METRICS_SUPPORTED_TAGS.has(key)
  );
  const hasCustomTags = searchFilterKeys.some(isCustomTag);
  return !isStandardSearch && (isOnDemandSupportedSearch || hasCustomTags);
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

const EXTRAPOLATED_AREA_STRIPE_IMG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAABkAQMAAACFAjPUAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAZQTFRFpKy5SVlzL3npZAAAAA9JREFUeJxjsD/AMIqIQwBIyGOd43jaDwAAAABJRU5ErkJggg==';

export const extrapolatedAreaStyle = {
  color: {
    repeat: 'repeat',
    image: EXTRAPOLATED_AREA_STRIPE_IMG,
    rotation: 0.785,
    scaleX: 0.5,
  },
  opacity: 1.0,
};

export function hasOnDemandMetricAlertFeature(organization: Organization) {
  return organization.features.includes('on-demand-metrics-extraction');
}

export function hasOnDemandMetricWidgetFeature(organization: Organization) {
  return (
    organization.features.includes('on-demand-metrics-extraction') &&
    organization.features.includes('on-demand-metrics-extraction-experimental')
  );
}
