import {useCallback} from 'react';
import {getFocusableTreeWalker} from '@react-aria/focus';
import type {ListState} from '@react-stately/list';
import type {Key, Node} from '@react-types/shared';

import type {
  SelectOptionOrSectionWithKey,
  SelectSectionWithKey,
} from '@sentry/scraps/compactSelect';

import {areWildcardOperatorsAllowed} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {
  TermOperator,
  WildcardOperators,
  type ParseResultToken,
} from 'sentry/components/searchSyntax/parser';
import type {Tag, TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {
  FieldKind,
  FieldValueType,
  prettifyTagKey,
  type FieldDefinition,
} from 'sentry/utils/fields';

export function shiftFocusToChild(
  element: HTMLElement,
  item: Node<ParseResultToken>,
  state: ListState<ParseResultToken>
) {
  // Ensure that the state is updated correctly
  state.selectionManager.setFocusedKey(item.key);

  // When this row gains focus, immediately shift focus to the input
  const walker = getFocusableTreeWalker(element);
  const nextNode = walker.nextNode();
  if (nextNode) {
    (nextNode as HTMLElement).focus();
  }
}

export function useShiftFocusToChild(
  item: Node<ParseResultToken>,
  state: ListState<ParseResultToken>
) {
  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      shiftFocusToChild(e.currentTarget, item, state);
    },
    [item, state]
  );

  return {
    shiftFocusProps: {onFocus},
  };
}

const EXPLICIT_TAG_KEY_PATTERN = /^tags\[(.*),(string|number|boolean)\]$/;

type ExplicitTagType = 'string' | 'number' | 'boolean';

type FilterKeyResolverItem = {
  options?: FilterKeyResolverItem[];
  tag?: Tag;
  textValue?: string;
  value?: string;
};

function getExplicitTagType(key: string): ExplicitTagType | null {
  const tagType = key.match(EXPLICIT_TAG_KEY_PATTERN)?.[2] as ExplicitTagType | undefined;
  return tagType ?? null;
}

function isQuotedExplicitTagKey(key: string): boolean {
  const tagName = key.match(EXPLICIT_TAG_KEY_PATTERN)?.[1];
  return !!tagName?.startsWith('"') && tagName.endsWith('"');
}

function tagMatchesInput(tag: Tag, input: string): boolean {
  const prettyKey = prettifyTagKey(tag.key);
  const matchValues = new Set([tag.key, prettyKey]);

  // Quoted explicit tag keys must be typed with their quotes. Their `name` can be
  // unquoted, so do not allow it as an alias unless it exactly matches the visible
  // pretty key.
  if (tag.name && (!isQuotedExplicitTagKey(tag.key) || tag.name === prettyKey)) {
    matchValues.add(tag.name);
  }

  return matchValues.has(input);
}

function tagFromResolverItem(item: FilterKeyResolverItem): Tag | null {
  if (item.tag) {
    return item.tag;
  }

  if (!item.value) {
    return null;
  }

  return {
    key: item.value,
    name: item.textValue ?? prettifyTagKey(item.value),
  };
}

function getTagsFromResolverItems(items: FilterKeyResolverItem[]): Tag[] {
  return items.flatMap(item => {
    if (item.options) {
      return getTagsFromResolverItems(item.options);
    }

    const tag = tagFromResolverItem(item);
    return tag ? [tag] : [];
  });
}

function findExplicitTagMatch(tags: Tag[], input: string): string | null {
  for (const tagType of ['string', 'number', 'boolean'] satisfies ExplicitTagType[]) {
    const match = tags.find(
      tag => getExplicitTagType(tag.key) === tagType && tagMatchesInput(tag, input)
    );
    if (match) {
      return match.key;
    }
  }

  return null;
}

export function resolveFilterKey({
  key,
  filterKeys,
  getSuggestedFilterKey,
  loadedItems = [],
}: {
  filterKeys: TagCollection;
  key: string;
  getSuggestedFilterKey?: (key: string) => string | null;
  loadedItems?: FilterKeyResolverItem[];
}): string {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return trimmedKey;
  }

  if (Object.hasOwn(filterKeys, trimmedKey)) {
    return trimmedKey;
  }

  const loadedTags = getTagsFromResolverItems(loadedItems);
  const exactLoadedMatch = loadedTags.find(tag => tag.key === trimmedKey);
  if (exactLoadedMatch) {
    return exactLoadedMatch.key;
  }

  const suggestedKey = getSuggestedFilterKey?.(trimmedKey);
  if (suggestedKey && suggestedKey !== trimmedKey) {
    return suggestedKey;
  }

  const staticExplicitMatch = findExplicitTagMatch(Object.values(filterKeys), trimmedKey);
  if (staticExplicitMatch) {
    return staticExplicitMatch;
  }

  const loadedExplicitMatch = findExplicitTagMatch(loadedTags, trimmedKey);
  if (loadedExplicitMatch) {
    return loadedExplicitMatch;
  }

  return trimmedKey;
}

export function getDefaultValueForValueType(valueType: FieldValueType | null): string {
  switch (valueType) {
    case FieldValueType.BOOLEAN:
      return 'true';
    case FieldValueType.INTEGER:
    case FieldValueType.NUMBER:
      return '100';
    case FieldValueType.CURRENCY:
      return '10';
    case FieldValueType.DATE:
      return '-24h';
    case FieldValueType.DURATION:
      return '10ms';
    case FieldValueType.SIZE:
      return '10bytes';
    case FieldValueType.PERCENTAGE:
      return '0.5';
    case FieldValueType.STRING:
    default:
      return '""';
  }
}

export function getDefaultFilterValue({
  fieldDefinition,
}: {
  fieldDefinition: FieldDefinition | null;
}): string {
  if (!fieldDefinition) {
    return '""';
  }

  if (defined(fieldDefinition.defaultValue)) {
    return fieldDefinition.defaultValue;
  }

  return getDefaultValueForValueType(fieldDefinition.valueType);
}

function getInitialFilterKeyText(key: string, fieldDefinition: FieldDefinition | null) {
  if (fieldDefinition?.kind === FieldKind.FUNCTION) {
    if (fieldDefinition.parameters) {
      const parametersText = fieldDefinition.parameters
        .filter(param => defined(param.defaultValue))
        .map(param => param.defaultValue)
        .join(',');

      return `${key}(${parametersText})`;
    }

    return `${key}()`;
  }

  return key;
}

function getInitialValueType(fieldDefinition: FieldDefinition | null) {
  if (!fieldDefinition) {
    return FieldValueType.STRING;
  }

  if (fieldDefinition.parameterDependentValueType) {
    return fieldDefinition.parameterDependentValueType(
      fieldDefinition.parameters?.map(p => p.defaultValue ?? null) ?? []
    );
  }

  return fieldDefinition.valueType ?? FieldValueType.STRING;
}

export function getInitialFilterText(
  key: string,
  fieldDefinition: FieldDefinition | null,
  operator: TermOperator = TermOperator.GREATER_THAN
) {
  const defaultValue = getDefaultFilterValue({fieldDefinition});

  const keyText = getInitialFilterKeyText(key, fieldDefinition);
  const valueType = getInitialValueType(fieldDefinition);

  switch (valueType) {
    case FieldValueType.INTEGER:
    case FieldValueType.NUMBER:
    case FieldValueType.CURRENCY:
    case FieldValueType.DURATION:
    case FieldValueType.SIZE:
    case FieldValueType.PERCENTAGE:
      return `${keyText}:${operator}${defaultValue}`;
    case FieldValueType.STRING: {
      return areWildcardOperatorsAllowed(fieldDefinition, valueType)
        ? `${keyText}:${WildcardOperators.CONTAINS}${defaultValue}`
        : `${keyText}:${defaultValue}`;
    }
    default:
      return `${keyText}:${defaultValue}`;
  }
}

export function itemIsSection(
  item: SelectOptionOrSectionWithKey<string>
): item is SelectSectionWithKey<string> {
  return 'options' in item;
}

export function findItemInSections<T extends SelectOptionOrSectionWithKey<string>>(
  items: T[],
  key: Key
): T | null {
  for (const item of items) {
    if (itemIsSection(item)) {
      const option = item.options.find(child => child.key === key);
      if (option) {
        return option as T;
      }
    } else {
      if (item.key === key) {
        return item;
      }
    }
  }
  return null;
}
