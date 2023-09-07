import React from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {
  ParseResult,
  parseSearch,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {FieldKey, getFieldDefinition} from 'sentry/utils/fields';
import {
  ON_DEMAND_METRICS_UNSUPPORTED_TAGS,
  STANDARD_SEARCH_FIELD_KEYS,
} from 'sentry/utils/onDemandMetrics/constants';
import {Color} from 'sentry/utils/theme';

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

export function OnDemandWarningIcon({
  msg,
  color = 'gray300',
}: {
  msg: React.ReactNode;
  color?: Color;
}) {
  return (
    <Tooltip title={msg}>
      <HoverableIconWarning color={color} />
    </Tooltip>
  );
}

const InfoAlert = styled(Alert)`
  border: 1px solid ${p => p.theme.blue400};

  & > span {
    display: flex;
    align-items: center;
  }
`;

const InfoICon = styled(IconInfo)`
  color: ${p => p.theme.blue400};
  margin-right: ${space(1.5)};
`;

export function OnDemandMetricAlert({message}: {message: React.ReactNode}) {
  return (
    <InfoAlert>
      <InfoICon size="sm" />
      {message}
    </InfoAlert>
  );
}

const HoverableIconWarning = styled(IconWarning)`
  &:hover {
    cursor: pointer;
  }
`;
