import styled from '@emotion/styled';

import {getEscapedKey} from 'sentry/components/core/compactSelect/utils';
import {ASK_SEER_CONSENT_ITEM_KEY} from 'sentry/components/searchQueryBuilder/askSeer/askSeerConsentOption';
import {ASK_SEER_ITEM_KEY} from 'sentry/components/searchQueryBuilder/askSeer/askSeerOption';
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {KeyDescription} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/keyDescription';
import type {
  AskSeerConsentItem,
  AskSeerItem,
  FilterValueItem,
  KeyItem,
  KeySectionItem,
  LogicFilterItem,
  RawSearchFilterIsValueItem,
  RawSearchItem,
  RecentQueryItem,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import type {
  FieldDefinitionGetter,
  FilterKeySection,
} from 'sentry/components/searchQueryBuilder/types';
import {
  WildcardOperators,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {
  getKeyLabel as getFilterKeyLabel,
  getKeyName,
} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import type {RecentSearch, Tag, TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {FieldKind, prettifyTagKey, type FieldDefinition} from 'sentry/utils/fields';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';

export const ALL_CATEGORY_VALUE = '__all';
export const RECENT_SEARCH_CATEGORY_VALUE = '__recent_searches';
export const LOGIC_CATEGORY_VALUE = '__logic_filters';

export const ALL_CATEGORY = {value: ALL_CATEGORY_VALUE, label: t('All')};
export const RECENT_SEARCH_CATEGORY = {
  value: RECENT_SEARCH_CATEGORY_VALUE,
  label: t('Recent'),
};
export const LOGIC_CATEGORY = {value: LOGIC_CATEGORY_VALUE, label: t('Logic')};

const RECENT_FILTER_KEY_PREFIX = '__recent_filter_key__';
const RECENT_QUERY_KEY_PREFIX = '__recent_search__';

function trimQuotes(value: any) {
  return value.replace(/^"+|"+$/g, '');
}

export function createRecentFilterOptionKey(filter: string) {
  return getEscapedKey(`${RECENT_FILTER_KEY_PREFIX}${filter}`);
}

function createRecentQueryOptionKey(filter: string) {
  return getEscapedKey(`${RECENT_QUERY_KEY_PREFIX}${filter}`);
}

export function getKeyLabel(
  tag: Tag,
  fieldDefinition: FieldDefinition | null,
  {includeAggregateArgs = false} = {}
) {
  if (fieldDefinition?.kind === FieldKind.FUNCTION) {
    if (fieldDefinition.parameters?.length) {
      if (includeAggregateArgs) {
        return `${tag.key}(${fieldDefinition.parameters.map(p => p.name).join(', ')})`;
      }
      return `${tag.key}(...)`;
    }
    return `${tag.key}()`;
  }

  // Some columns in explore can be formatted as an explicity number tag.
  // We want to strip the explicit tag syntax before displaying where possible.
  return prettifyTagKey(tag.key);
}

export function createSection(
  section: FilterKeySection,
  keys: TagCollection,
  getFieldDefinition: FieldDefinitionGetter
): KeySectionItem {
  return {
    key: section.value,
    value: section.value,
    label: section.label,
    options: section.children
      .map(key => {
        if (!keys[key]) {
          return null;
        }
        return createItem(keys[key], getFieldDefinition(key), section);
      })
      .filter(defined),
    type: 'section',
  };
}

export function createItem(
  tag: Tag,
  fieldDefinition: FieldDefinition | null,
  section?: FilterKeySection
): KeyItem {
  const description = fieldDefinition?.desc;

  const key = section ? `${section.value}:${tag.key}` : tag.key;

  return {
    key: getEscapedKey(key),
    label: getKeyLabel(tag, fieldDefinition),
    description: description ?? '',
    value: tag.key,
    textValue: tag.key,
    hideCheck: true,
    showDetailsInOverlay: true,
    details: () => <KeyDescription tag={tag} />,
    type: 'item',
    trailingItems: () => (
      <TypeBadge
        kind={(fieldDefinition?.kind || tag?.kind) ?? undefined}
        valueType={fieldDefinition?.valueType ?? undefined}
      />
    ),
  };
}

export function createRawSearchItem(value: string): RawSearchItem {
  const quoted = `"${trimQuotes(value)}"`;

  return {
    key: getEscapedKey(quoted),
    label: quoted,
    value: quoted,
    textValue: quoted,
    hideCheck: true,
    showDetailsInOverlay: true,
    details: null,
    type: 'raw-search',
    trailingItems: () => <SearchItemLabel>{t('Raw Search')}</SearchItemLabel>,
  };
}

export function createFilterValueItem(key: string, value: string): FilterValueItem {
  const filter = `${key}:${escapeFilterValue(value)}`;

  return {
    key: getEscapedKey(`${key}:${value}`),
    label: <FormattedQuery query={filter} />,
    value: filter,
    textValue: filter,
    hideCheck: true,
    showDetailsInOverlay: true,
    details: null,
    type: 'filter-value',
  };
}

export function createRawSearchFilterIsValueItem(
  key: string,
  value: string
): RawSearchFilterIsValueItem {
  const filter = `${key}:${value}`;

  return {
    key: getEscapedKey(filter),
    label: <FormattedQuery query={filter} />,
    value: filter,
    textValue: filter,
    hideCheck: true,
    showDetailsInOverlay: true,
    details: null,
    type: 'raw-search-filter-is-value',
  };
}

export function createRawSearchFilterContainsValueItem(
  key: string,
  value: string
): RawSearchFilterIsValueItem {
  const filter = `${key}:${WildcardOperators.CONTAINS}${escapeFilterValue(value)}`;

  return {
    key: getEscapedKey(`${key}:${WildcardOperators.CONTAINS}${value}`),
    label: <FormattedQuery query={filter} />,
    value: filter,
    textValue: filter,
    hideCheck: true,
    showDetailsInOverlay: true,
    details: null,
    type: 'raw-search-filter-is-value',
  };
}

export function createRawSearchFuzzyFilterItem(
  key: string,
  value: string
): RawSearchFilterIsValueItem {
  const formattedValue = escapeFilterValue(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replaceAll(' ', '*');

  const filter = `${key}:*${formattedValue}*`;

  return {
    key: getEscapedKey(filter),
    label: <FormattedQuery query={filter} />,
    value: filter,
    textValue: filter,
    hideCheck: true,
    showDetailsInOverlay: true,
    details: null,
    type: 'raw-search-filter-is-value',
  };
}

export function createRecentFilterItem({filter}: {filter: TokenResult<Token.FILTER>}) {
  const key = getKeyName(filter.key);
  return {
    key: createRecentFilterOptionKey(key),
    value: key,
    textValue: key,
    type: 'recent-filter' as const,
    label: getFilterKeyLabel(filter.key),
  };
}

export function createRecentQueryItem({
  search,
  getFieldDefinition,
  filterKeys,
}: {
  filterKeys: TagCollection;
  getFieldDefinition: FieldDefinitionGetter;
  search: RecentSearch;
}): RecentQueryItem {
  return {
    key: createRecentQueryOptionKey(search.query),
    value: search.query,
    textValue: search.query,
    type: 'recent-query' as const,
    label: (
      <FormattedQuery
        query={search.query}
        filterKeys={filterKeys}
        fieldDefinitionGetter={getFieldDefinition}
      />
    ),
    hideCheck: true,
  };
}

export function createAskSeerItem(): AskSeerItem {
  return {
    key: getEscapedKey(ASK_SEER_ITEM_KEY),
    value: ASK_SEER_ITEM_KEY,
    textValue: 'Ask AI to build your query',
    type: 'ask-seer' as const,
    label: t('Ask AI to build your query'),
    hideCheck: true,
  };
}

export function createAskSeerConsentItem(): AskSeerConsentItem {
  return {
    key: getEscapedKey(ASK_SEER_CONSENT_ITEM_KEY),
    value: ASK_SEER_CONSENT_ITEM_KEY,
    textValue: 'Enable Gen AI',
    type: 'ask-seer-consent' as const,
    label: t('Enable Gen AI'),
    hideCheck: true,
  };
}

export function createLogicFilterItem({
  value,
}: {
  value: 'AND' | 'OR' | '(' | ')';
}): LogicFilterItem {
  return {
    key: getEscapedKey(value),
    type: 'logic-filter' as const,
    value,
    label: value,
    textValue: value,
    hideCheck: true,
    showDetailsInOverlay: true,
    trailingItems: () => <TypeBadge isLogicFilter />,
  };
}

const SearchItemLabel = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
`;
