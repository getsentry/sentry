// eslint-disable-next-line simple-import-sort/imports
import type {TokenResult} from 'sentry/components/searchSyntax/parser';
import {
  filterTypeConfig,
  interchangeableFilterOperators,
  TermOperator,
  Token,
} from 'sentry/components/searchSyntax/parser';
import {
  IconArrow,
  IconClock,
  IconDelete,
  IconExclamation,
  IconStar,
  IconTag,
  IconToggle,
  IconUser,
} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {AutocompleteGroup, SearchGroup, SearchItem, Shortcut} from './types';
import {ItemType, ShortcutType, invalidTypes} from './types';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, FieldValueType, getFieldDefinition} from 'sentry/utils/fields';

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

function getTitleForType(type: ItemType) {
  if (type === ItemType.TAG_VALUE) {
    return t('Values');
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

  if (type === ItemType.PROPERTY) {
    return t('Properties');
  }

  return t('Keys');
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
    case 'assigned_or_suggested':
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

const filterSearchItems = (
  searchItems: SearchItem[],
  recentSearchItems?: SearchItem[],
  maxSearchItems?: number,
  queryCharsLeft?: number
): {recentSearchItems: SearchItem[] | undefined; searchItems: SearchItem[]} => {
  if (maxSearchItems && maxSearchItems > 0) {
    searchItems = searchItems.filter(
      (value: SearchItem, index: number) =>
        index < maxSearchItems || value.ignoreMaxSearchItems
    );
  }

  if (queryCharsLeft || queryCharsLeft === 0) {
    searchItems = searchItems.flatMap(item => {
      if (!item.children) {
        if (!item.value || item.value.length <= queryCharsLeft) {
          return [item];
        }
        return [];
      }

      const newItem = {
        ...item,
        children: item.children.filter(
          child => !child.value || child.value.length <= queryCharsLeft
        ),
      };

      if (newItem.children.length === 0) {
        return [];
      }

      return [newItem];
    });
    searchItems = searchItems.filter(
      value => !value.value || value.value.length <= queryCharsLeft
    );

    if (recentSearchItems) {
      recentSearchItems = recentSearchItems.filter(
        value => !value.value || value.value.length <= queryCharsLeft
      );
    }
  }

  return {searchItems, recentSearchItems};
};

interface SearchGroups {
  activeSearchItem: number;
  flatSearchItems: SearchItem[];
  searchGroups: SearchGroup[];
}

function isSearchGroup(searchItem: SearchItem | SearchGroup): searchItem is SearchGroup {
  return (
    (searchItem as SearchGroup).children !== undefined && searchItem.type === 'header'
  );
}

function isSearchGroupArray(items: SearchItem[] | SearchGroup[]): items is SearchGroup[] {
  // Typescript doesn't like that there's no shared properties between SearchItem and SearchGroup
  return (items as any[]).every(isSearchGroup);
}

export function createSearchGroups(
  searchGroupItems: SearchItem[] | SearchGroup[],
  recentSearchItems: SearchItem[] | undefined,
  tagName: string,
  type: ItemType,
  maxSearchItems?: number,
  queryCharsLeft?: number,
  isDefaultState?: boolean,
  defaultSearchGroup?: SearchGroup,
  fieldDefinitionGetter: typeof getFieldDefinition = getFieldDefinition
): SearchGroups {
  const searchGroup: SearchGroup = {
    title: getTitleForType(type),
    type: invalidTypes.includes(type) ? type : 'header',
    icon: getIconForTypeAndTag(type, tagName),
    children: [],
  };

  if (isSearchGroupArray(searchGroupItems)) {
    // Autocomplete item has provided its own search groups
    const searchGroups = searchGroupItems
      .map(group => {
        const {searchItems: filteredSearchItems} = filterSearchItems(
          group.children,
          recentSearchItems,
          maxSearchItems,
          queryCharsLeft
        );
        return {...group, children: filteredSearchItems};
      })
      .filter(group => group.children.length > 0);
    return {
      // Fallback to the blank search group when "no items found"
      searchGroups: searchGroups.length ? searchGroups : [searchGroup],
      flatSearchItems: searchGroups.flatMap(item => item.children ?? []),
      activeSearchItem: -1,
    };
  }

  const fieldDefinition = fieldDefinitionGetter(tagName);

  const activeSearchItem = 0;
  const {searchItems: filteredSearchItems, recentSearchItems: filteredRecentSearchItems} =
    filterSearchItems(
      searchGroupItems,
      recentSearchItems,
      maxSearchItems,
      queryCharsLeft
    );

  const recentSearchGroup: SearchGroup | undefined =
    filteredRecentSearchItems && filteredRecentSearchItems.length > 0
      ? {
          title: t('Recent Searches'),
          type: 'header',
          icon: <IconClock size="xs" />,
          children: [...filteredRecentSearchItems],
        }
      : undefined;

  searchGroup.children = filteredSearchItems;

  if (searchGroup.children && !!searchGroup.children.length) {
    searchGroup.children[activeSearchItem] = {
      ...searchGroup.children[activeSearchItem],
    };
  }

  const flatSearchItems = filteredSearchItems.flatMap(item => {
    if (item.children) {
      if (!item.value) {
        return [...item.children];
      }
      return [item, ...item.children];
    }
    return [item];
  });

  if (fieldDefinition?.valueType === FieldValueType.DATE) {
    if (type === ItemType.TAG_OPERATOR) {
      return {
        searchGroups: [],
        flatSearchItems: [],
        activeSearchItem: -1,
      };
    }
  }

  if (isDefaultState) {
    // Recent searches first in default state.
    return {
      searchGroups: [
        ...(recentSearchGroup ? [recentSearchGroup] : []),
        ...(defaultSearchGroup ? [defaultSearchGroup] : []),
        searchGroup,
      ],
      flatSearchItems: [
        ...(recentSearchItems ? recentSearchItems : []),
        ...(defaultSearchGroup ? defaultSearchGroup.children : []),
        ...flatSearchItems,
      ],
      activeSearchItem: -1,
    };
  }

  return {
    searchGroups: [searchGroup, ...(recentSearchGroup ? [recentSearchGroup] : [])],
    flatSearchItems: [
      ...flatSearchItems,
      ...(recentSearchItems ? recentSearchItems : []),
    ],
    activeSearchItem: -1,
  };
}

export function generateOperatorEntryMap(tag: string) {
  return {
    [TermOperator.DEFAULT]: {
      type: ItemType.TAG_OPERATOR,
      value: ':',
      desc: `${tag}:${t('[value]')}`,
      documentation: 'is equal to',
    },
    [TermOperator.GREATER_THAN_EQUAL]: {
      type: ItemType.TAG_OPERATOR,
      value: ':>=',
      desc: `${tag}:${t('>=[value]')}`,
      documentation: 'is greater than or equal to',
    },
    [TermOperator.LESS_THAN_EQUAL]: {
      type: ItemType.TAG_OPERATOR,
      value: ':<=',
      desc: `${tag}:${t('<=[value]')}`,
      documentation: 'is less than or equal to',
    },
    [TermOperator.GREATER_THAN]: {
      type: ItemType.TAG_OPERATOR,
      value: ':>',
      desc: `${tag}:${t('>[value]')}`,
      documentation: 'is greater than',
    },
    [TermOperator.LESS_THAN]: {
      type: ItemType.TAG_OPERATOR,
      value: ':<',
      desc: `${tag}:${t('<[value]')}`,
      documentation: 'is less than',
    },
    [TermOperator.EQUAL]: {
      type: ItemType.TAG_OPERATOR,
      value: ':=',
      desc: `${tag}:${t('=[value]')}`,
      documentation: 'is equal to',
    },
    [TermOperator.NOT_EQUAL]: {
      type: ItemType.TAG_OPERATOR,
      value: '!:',
      desc: `!${tag}:${t('[value]')}`,
      documentation: 'is not equal to',
    },
  };
}

export function getValidOps(
  filterToken: TokenResult<Token.FILTER>,
  disallowNegation: boolean
): readonly TermOperator[] {
  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = filterToken.invalid?.expectedType ?? [filterToken.filter];

  // Determine any interchangeable filter types for our valid types
  const interchangeableTypes = validTypes.map(
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    type => interchangeableFilterOperators[type] ?? []
  );

  // Combine all types
  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes.flat()])];

  // Find all valid operations
  const validOps = new Set<TermOperator>(
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    allValidTypes.flatMap(type => filterTypeConfig[type].validOps)
  );

  if (disallowNegation) {
    validOps.delete(TermOperator.NOT_EQUAL);
  }

  return [...validOps];
}

export const shortcuts: Shortcut[] = [
  {
    text: 'Delete',
    shortcutType: ShortcutType.DELETE,
    hotkeys: {
      actual: 'ctrl+option+backspace',
    },
    icon: <IconDelete size="xs" color="gray300" />,
    canRunShortcut: token => {
      return token?.type === Token.FILTER;
    },
  },
  {
    text: 'Exclude',
    shortcutType: ShortcutType.NEGATE,
    hotkeys: {
      actual: 'ctrl+option+1',
    },
    icon: <IconExclamation size="xs" color="gray300" />,
    canRunShortcut: token => {
      return token?.type === Token.FILTER && !token.negated;
    },
  },
  {
    text: 'Include',
    shortcutType: ShortcutType.NEGATE,
    hotkeys: {
      actual: 'ctrl+option+1',
    },
    icon: <IconExclamation size="xs" color="gray300" />,
    canRunShortcut: token => {
      return token?.type === Token.FILTER && token.negated;
    },
  },

  {
    text: 'Previous',
    shortcutType: ShortcutType.PREVIOUS,
    hotkeys: {
      actual: 'ctrl+option+left',
    },
    icon: <IconArrow direction="left" size="xs" color="gray300" />,
    canRunShortcut: (token, count) => {
      return count > 1 || (count > 0 && token?.type !== Token.FILTER);
    },
  },
  {
    text: 'Next',
    shortcutType: ShortcutType.NEXT,
    hotkeys: {
      actual: 'ctrl+option+right',
    },
    icon: <IconArrow direction="right" size="xs" color="gray300" />,
    canRunShortcut: (token, count) => {
      return count > 1 || (count > 0 && token?.type !== Token.FILTER);
    },
  },
];

const getItemTitle = (key: string, kind: FieldKind) => {
  if (kind === FieldKind.FUNCTION) {
    // Replace the function innards with ... for cleanliness
    return key.replace(/\(.*\)/g, '(...)');
  }

  return key;
};

/**
 * Groups tag keys based on the "." character in their key.
 * For example, "device.arch" and "device.name" will be grouped together as children of "device", a non-interactive parent.
 * The parent will become interactive if there exists a key "device".
 */
export const getTagItemsFromKeys = (
  tagKeys: ReadonlyArray<Readonly<string>>,
  supportedTags: TagCollection,
  fieldDefinitionGetter: typeof getFieldDefinition = getFieldDefinition
) => {
  return tagKeys.reduce<SearchItem[]>((groups: SearchItem[], key: string) => {
    const keyWithColon = `${key}:`;
    const sections = key.split('.');

    const definition =
      supportedTags[key]?.kind === FieldKind.FUNCTION
        ? fieldDefinitionGetter(key.split('(')[0]!)
        : fieldDefinitionGetter(key);
    const kind = supportedTags[key]?.kind ?? definition?.kind ?? FieldKind.FIELD;

    const item: SearchItem = {
      value: keyWithColon,
      title: getItemTitle(key, kind),
      documentation: definition?.desc ?? '-',
      kind,
      deprecated: definition?.deprecated,
      featureFlag: definition?.featureFlag,
    };

    const lastGroup = groups.at(-1);

    const [title] = sections;

    if (kind !== FieldKind.FUNCTION && lastGroup) {
      if (lastGroup.children && lastGroup.title === title) {
        lastGroup.children.push(item);
        return groups;
      }

      if (lastGroup.title && lastGroup.title.split('.')[0] === title) {
        if (lastGroup.title === title) {
          return [
            ...groups.slice(0, -1),
            {
              title,
              value: lastGroup.value,
              documentation: lastGroup.documentation,
              kind: lastGroup.kind,
              children: [item],
            },
          ];
        }

        // Add a blank parent if the last group's full key is not the same as the title
        return [
          ...groups.slice(0, -1),
          {
            title,
            value: null,
            documentation: '-',
            kind: lastGroup.kind,
            children: [lastGroup, item],
          },
        ];
      }
    }
    groups.push(item);
    return groups;
  }, []);
};

/**
 * Sets an item as active within a search group array and returns new search groups without mutating.
 * the item is compared via value, so this function assumes that each value is unique.
 */
export const getSearchGroupWithItemMarkedActive = (
  searchGroups: SearchGroup[],
  currentItem: SearchItem,
  active: boolean
): SearchGroup[] => {
  return searchGroups.map(group => ({
    ...group,
    children: group.children?.map(item => {
      if (item.value === currentItem.value && item.type === currentItem.type) {
        return {
          ...item,
          active,
        };
      }

      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: item.children.map(child => {
            if (child.value === currentItem.value && item.type === currentItem.type) {
              return {
                ...child,
                active,
              };
            }

            return child;
          }),
        };
      }

      return item;
    }),
  }));
};

/**
 * Filter tag keys based on the query and the key, description, and associated keywords of each tag.
 */
export const filterKeysFromQuery = (
  tagKeys: string[],
  searchTerm: string,
  fieldDefinitionGetter: typeof getFieldDefinition = getFieldDefinition
): string[] =>
  tagKeys
    .flatMap(key => {
      const keyWithoutFunctionPart = key.replaceAll(/\(.*\)/g, '').toLocaleLowerCase();
      const definition = fieldDefinitionGetter(keyWithoutFunctionPart);
      const lowerCasedSearchTerm = searchTerm.toLocaleLowerCase();

      const combinedKeywords = [
        ...(definition?.desc ? [definition.desc] : []),
        ...(definition?.keywords ?? []),
      ]
        .join(' ')
        .toLocaleLowerCase();

      const matchedInKey = keyWithoutFunctionPart.includes(lowerCasedSearchTerm);
      const matchedInKeywords = combinedKeywords.includes(lowerCasedSearchTerm);

      if (!matchedInKey && !matchedInKeywords) {
        return [];
      }

      return [{matchedInKey, matchedInKeywords, key}];
    })
    .sort((a, b) => {
      // Sort by matched in key first, then by matched in keywords
      if (a.matchedInKey && !b.matchedInKey) {
        return -1;
      }

      if (b.matchedInKey && !a.matchedInKey) {
        return 1;
      }

      return a.key < b.key ? -1 : 1;
    })
    .map(({key}) => key);

const DATE_SUGGESTED_VALUES = [
  {
    title: t('Last hour'),
    value: '-1h',
    desc: '-1h',
    type: ItemType.TAG_VALUE,
  },
  {
    title: t('Last 24 hours'),
    value: '-24h',
    desc: '-24h',
    type: ItemType.TAG_VALUE,
  },
  {
    title: t('Last 7 days'),
    value: '-7d',
    desc: '-7d',
    type: ItemType.TAG_VALUE,
  },
  {
    title: t('Last 14 days'),
    value: '-14d',
    desc: '-14d',
    type: ItemType.TAG_VALUE,
  },
  {
    title: t('Last 30 days'),
    value: '-30d',
    desc: '-30d',
    type: ItemType.TAG_VALUE,
  },
  {
    title: t('After a custom datetime'),
    value: '>',
    desc: '>YYYY-MM-DDThh:mm:ss',
    type: ItemType.TAG_VALUE_ISO_DATE,
  },
  {
    title: t('Before a custom datetime'),
    value: '<',
    desc: '<YYYY-MM-DDThh:mm:ss',
    type: ItemType.TAG_VALUE_ISO_DATE,
  },
  {
    title: t('At a custom datetime'),
    value: '=',
    desc: '=YYYY-MM-DDThh:mm:ss',
    type: ItemType.TAG_VALUE_ISO_DATE,
  },
] satisfies SearchItem[];

export const getDateTagAutocompleteGroups = (tagName: string): AutocompleteGroup[] => {
  return [
    {
      searchItems: DATE_SUGGESTED_VALUES,
      recentSearchItems: [],
      tagName,
      type: ItemType.TAG_VALUE,
    },
  ];
};

/**
 * Gets an invalid group for when the usage of wildcards are not allowed and it is used in the search query.
 * When this group is set, a message with a link to the documentation is displayed to the user in the dropdown.
 */
export function getAutoCompleteGroupForInvalidWildcard(searchText: string) {
  return [
    {
      searchItems: [
        {
          type: ItemType.INVALID_QUERY_WITH_WILDCARD,
          desc: searchText,
          callback: () =>
            window.open(
              'https://docs.sentry.io/product/sentry-basics/search/searchable-properties/'
            ),
        },
      ],
      recentSearchItems: [],
      tagName: searchText,
      type: ItemType.INVALID_QUERY_WITH_WILDCARD,
    },
  ];
}

export function escapeTagValue(value: string): string {
  // Wrap in quotes if there is a space
  const isArrayTag = value.startsWith('[') && value.endsWith(']') && value.includes(',');
  return (value.includes(' ') || value.includes('"')) && !isArrayTag
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
}
