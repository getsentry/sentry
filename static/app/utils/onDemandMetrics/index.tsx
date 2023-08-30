import React from 'react';
import styled from '@emotion/styled';

import {ParseResult, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {Organization} from 'sentry/types';
import {FieldKey, getFieldDefinition} from 'sentry/utils/fields';
import {
  ON_DEMAND_METRICS_SUPPORTED_TAGS,
  STANDARD_SEARCH_FIELD_KEYS,
} from 'sentry/utils/onDemandMetrics/constants';

function isStandardSearchFilterKey(key: string): boolean {
  return STANDARD_SEARCH_FIELD_KEYS.has(key as FieldKey);
}

function isOnDemandSupportedFilterKey(key: string): boolean {
  return ON_DEMAND_METRICS_SUPPORTED_TAGS.has(key as FieldKey);
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

function getTokenKeyValuePair(token): SearchFilter[] | SearchFilter | null {
  if (token.type === Token.LOGIC_GROUP) {
    return getSearchFiltersFromTokens(token.inner);
  }
  if (token.type === Token.FILTER) {
    return {key: token.key.value, operator: token.operator, value: token.value.value};
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

export function OnDemandWarningIcon({msg}: {msg: React.ReactNode}) {
  return (
    <Tooltip title={msg}>
      <HoverableIconWarning color="gray300" />
    </Tooltip>
  );
}

const HoverableIconWarning = styled(IconWarning)`
  &:hover {
    cursor: pointer;
  }
`;
