import styled from '@emotion/styled';

import {getEscapedKey} from 'sentry/components/compactSelect/utils';
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {KeyDescription} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/keyDescription';
import type {
  FilterValueItem,
  KeyItem,
  KeySectionItem,
  RawSearchItem,
  RecentQueryItem,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import type {
  FieldDefinitionGetter,
  FilterKeySection,
} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {RecentSearch, Tag, TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {type FieldDefinition, FieldKind} from 'sentry/utils/fields';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';

export const ALL_CATEGORY_VALUE = '__all' as const;
export const RECENT_SEARCH_CATEGORY_VALUE = '__recent_searches' as const;

export const ALL_CATEGORY = {value: ALL_CATEGORY_VALUE, label: t('All')};
export const RECENT_SEARCH_CATEGORY = {
  value: RECENT_SEARCH_CATEGORY_VALUE,
  label: t('Recent'),
};

const RECENT_FILTER_KEY_PREFIX = '__recent_filter_key__';
const RECENT_QUERY_KEY_PREFIX = '__recent_search__';

function trimQuotes(value: any) {
  return value.replace(/^"+|"+$/g, '');
}

export function createRecentFilterOptionKey(filter: string) {
  return getEscapedKey(`${RECENT_FILTER_KEY_PREFIX}${filter}`);
}

export function createRecentQueryOptionKey(filter: string) {
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

  return tag.key;
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
    details: <KeyDescription tag={tag} />,
    type: 'item',
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
    trailingItems: <SearchItemLabel>{t('Raw Search')}</SearchItemLabel>,
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

export function createRecentFilterItem({filter}: {filter: string}) {
  return {
    key: createRecentFilterOptionKey(filter),
    value: filter,
    textValue: filter,
    type: 'recent-filter' as const,
    label: filter,
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

const SearchItemLabel = styled('div')`
  color: ${p => p.theme.subText};
  white-space: nowrap;
`;
