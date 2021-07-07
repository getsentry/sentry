import {
  filterTypeConfig,
  interchangeableFilterOperators,
  TermOperator,
  Token,
  TokenResult,
} from 'app/components/searchSyntax/parser';
import {IconClock, IconStar, IconTag, IconToggle, IconUser} from 'app/icons';
import {t} from 'app/locale';

import {ItemType, SearchGroup, SearchItem} from './types';

export function addSpace(query = '') {
  if (query.length !== 0 && query[query.length - 1] !== ' ') {
    return query + ' ';
  }

  return query;
}

export function removeSpace(query = '') {
  if (query[query.length - 1] === ' ') {
    return query.slice(0, query.length - 1);
  }

  return query;
}

/**
 * Given a query, and the current cursor position, return the string-delimiting
 * index of the search term designated by the cursor.
 */
export function getLastTermIndex(query: string, cursor: number) {
  // TODO: work with quoted-terms
  const cursorOffset = query.slice(cursor).search(/\s|$/);
  return cursor + (cursorOffset === -1 ? 0 : cursorOffset);
}

/**
 * Returns an array of query terms, including incomplete terms
 *
 * e.g. ["is:unassigned", "browser:\"Chrome 33.0\"", "assigned"]
 */
export function getQueryTerms(query: string, cursor: number) {
  return query.slice(0, cursor).match(/\S+:"[^"]*"?|\S+/g);
}

function getTitleForType(type: ItemType) {
  if (type === ItemType.TAG_VALUE) {
    return t('Tag Values');
  }

  if (type === ItemType.RECENT_SEARCH) {
    return t('Recent Searches');
  }

  if (type === ItemType.DEFAULT) {
    return t('Common Search Terms');
  }

  if (type === ItemType.TAG_OPERATOR) {
    return t('Operator Helpers');
  }

  return t('Tags');
}

function getIconForTypeAndTag(type: ItemType, tagName: string) {
  if (type === ItemType.RECENT_SEARCH) {
    return <IconClock size="xs" />;
  }

  if (type === ItemType.DEFAULT) {
    return <IconStar size="xs" />;
  }

  // Change based on tagName and default to "icon-tag"
  switch (tagName) {
    case 'is':
      return <IconToggle size="xs" />;
    case 'assigned':
    case 'bookmarks':
      return <IconUser size="xs" />;
    case 'firstSeen':
    case 'lastSeen':
    case 'event.timestamp':
      return <IconClock size="xs" />;
    default:
      return <IconTag size="xs" />;
  }
}

export function createSearchGroups(
  searchItems: SearchItem[],
  recentSearchItems: SearchItem[] | undefined,
  tagName: string,
  type: ItemType,
  maxSearchItems: number | undefined,
  queryCharsLeft?: number
) {
  const activeSearchItem = 0;

  if (maxSearchItems && maxSearchItems > 0) {
    searchItems = searchItems.filter(
      (value: SearchItem, index: number) =>
        index < maxSearchItems || value.ignoreMaxSearchItems
    );
  }

  if (queryCharsLeft || queryCharsLeft === 0) {
    searchItems = searchItems.filter(
      (value: SearchItem) => value.value.length <= queryCharsLeft
    );
    if (recentSearchItems) {
      recentSearchItems = recentSearchItems.filter(
        (value: SearchItem) => value.value.length <= queryCharsLeft
      );
    }
  }

  const searchGroup: SearchGroup = {
    title: getTitleForType(type),
    type: type === ItemType.INVALID_TAG ? type : 'header',
    icon: getIconForTypeAndTag(type, tagName),
    children: [...searchItems],
  };

  const recentSearchGroup: SearchGroup | undefined = recentSearchItems && {
    title: t('Recent Searches'),
    type: 'header',
    icon: <IconClock size="xs" />,
    children: [...recentSearchItems],
  };

  if (searchGroup.children && !!searchGroup.children.length) {
    searchGroup.children[activeSearchItem] = {
      ...searchGroup.children[activeSearchItem],
    };
  }

  return {
    searchGroups: [searchGroup, ...(recentSearchGroup ? [recentSearchGroup] : [])],
    flatSearchItems: [...searchItems, ...(recentSearchItems ? recentSearchItems : [])],
    activeSearchItem: -1,
  };
}

/**
 * Items is a list of dropdown groups that have a `children` field. Only the
 * `children` are selectable, so we need to find which child is selected given
 * an index that is in range of the sum of all `children` lengths
 *
 * @return Returns a tuple of [groupIndex, childrenIndex]
 */
export function filterSearchGroupsByIndex(items: SearchGroup[], index: number) {
  let _index = index;
  let foundSearchItem: [number?, number?] = [undefined, undefined];

  items.find(({children}, i) => {
    if (!children || !children.length) {
      return false;
    }
    if (_index < children.length) {
      foundSearchItem = [i, _index];
      return true;
    }

    _index -= children.length;
    return false;
  });

  return foundSearchItem;
}

export function generateOperatorEntryMap(tag: string) {
  return {
    [TermOperator.Default]: {
      type: ItemType.TAG_OPERATOR,
      value: ':',
      desc: `${tag}:${t('[value] is equal to')}`,
    },
    [TermOperator.GreaterThanEqual]: {
      type: ItemType.TAG_OPERATOR,
      value: ':>=',
      desc: `${tag}:${t('>=[value] is greater than or equal to')}`,
    },
    [TermOperator.LessThanEqual]: {
      type: ItemType.TAG_OPERATOR,
      value: ':<=',
      desc: `${tag}:${t('<=[value] is less than or equal to')}`,
    },
    [TermOperator.GreaterThan]: {
      type: ItemType.TAG_OPERATOR,
      value: ':>',
      desc: `${tag}:${t('>[value] is greater than')}`,
    },
    [TermOperator.LessThan]: {
      type: ItemType.TAG_OPERATOR,
      value: ':<',
      desc: `${tag}:${t('<[value] is less than')}`,
    },
    [TermOperator.Equal]: {
      type: ItemType.TAG_OPERATOR,
      value: ':=',
      desc: `${tag}:${t('=[value] is equal to')}`,
    },
    [TermOperator.NotEqual]: {
      type: ItemType.TAG_OPERATOR,
      value: '!:',
      desc: `!${tag}:${t('[value] is not equal to')}`,
    },
  };
}

export function getValidOps(
  filterToken: TokenResult<Token.Filter>
): readonly TermOperator[] {
  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = filterToken.invalid?.expectedType ?? [filterToken.filter];

  // Determine any interchangable filter types for our valid types
  const interchangeableTypes = validTypes.map(
    type => interchangeableFilterOperators[type] ?? []
  );

  // Combine all types
  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes.flat()])];

  // Find all valid operations
  const validOps = new Set<TermOperator>(
    allValidTypes.map(type => filterTypeConfig[type].validOps).flat()
  );

  return [...validOps];
}
