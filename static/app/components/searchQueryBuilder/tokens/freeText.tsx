import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent, Node} from '@react-types/shared';
import type Fuse from 'fuse.js';

import {getEscapedKey} from 'sentry/components/compactSelect/utils';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderGridItem';
import {replaceTokensWithPadding} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {
  getDefaultFilterValue,
  useShiftFocusToChild,
} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {
  FieldDefinitionGetter,
  FilterKeySection,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import {
  type ParseResultToken,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {type FieldDefinition, FieldKind, FieldValueType} from 'sentry/utils/fields';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useOrganization from 'sentry/utils/useOrganization';

type SearchQueryBuilderInputProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
};

type SearchQueryBuilderInputInternalProps = {
  item: Node<ParseResultToken>;
  rowRef: React.RefObject<HTMLDivElement>;
  state: ListState<ParseResultToken>;
  tabIndex: number;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
};

type KeyItem = {
  description: string;
  details: React.ReactNode;
  hideCheck: boolean;
  key: string;
  label: string;
  showDetailsInOverlay: boolean;
  textValue: string;
  value: string;
};

type KeySectionItem = {
  key: string;
  options: KeyItem[];
  title: React.ReactNode;
  value: string;
};

const FUZZY_SEARCH_OPTIONS: Fuse.IFuseOptions<KeyItem> = {
  keys: ['label', 'description'],
  threshold: 0.2,
  includeMatches: false,
  minMatchCharLength: 1,
};

function isSection(item: KeyItem | KeySectionItem): item is KeySectionItem {
  return 'options' in item;
}

function getWordAtCursorPosition(value: string, cursorPosition: number) {
  const words = value.split(' ');

  let characterCount = 0;
  for (const word of words) {
    characterCount += word.length + 1;
    if (characterCount >= cursorPosition) {
      return word;
    }
  }

  return value;
}

function getInitialFilterText(key: string, fieldDefinition: FieldDefinition | null) {
  const defaultValue = getDefaultFilterValue({key, fieldDefinition});

  switch (fieldDefinition?.valueType) {
    case FieldValueType.INTEGER:
    case FieldValueType.NUMBER:
    case FieldValueType.DURATION:
    case FieldValueType.PERCENTAGE:
      return `${key}:>${defaultValue}`;
    case FieldValueType.STRING:
    default:
      return `${key}:${defaultValue}`;
  }
}

/**
 * Replaces the focused word (at cursorPosition) with the selected filter key.
 *
 * Example:
 * replaceFocusedWordWithFilter('before brow after', 9, 'browser.name') => 'before browser.name: after'
 */
function replaceFocusedWordWithFilter(
  value: string,
  cursorPosition: number,
  key: string,
  getFieldDefinition: FieldDefinitionGetter
) {
  const words = value.split(' ');

  let characterCount = 0;
  for (const word of words) {
    characterCount += word.length + 1;
    if (characterCount >= cursorPosition) {
      return (
        value.slice(0, characterCount - word.length - 1).trim() +
        ` ${getInitialFilterText(key, getFieldDefinition(key))} ` +
        value.slice(characterCount).trim()
      ).trim();
    }
  }

  return value;
}

function createItem(tag: Tag, fieldDefinition: FieldDefinition | null): KeyItem {
  const description = fieldDefinition?.desc;

  return {
    key: getEscapedKey(tag.key),
    label: tag.alias ?? tag.key,
    description: description ?? '',
    value: tag.key,
    textValue: tag.key,
    hideCheck: true,
    showDetailsInOverlay: true,
    details: fieldDefinition?.desc ? <KeyDescription tag={tag} /> : null,
  };
}

function createSection(
  section: FilterKeySection,
  keys: TagCollection,
  getFieldDefinition: FieldDefinitionGetter
): KeySectionItem {
  return {
    key: section.value,
    value: section.value,
    title: section.label,
    options: section.children.map(key => createItem(keys[key], getFieldDefinition(key))),
  };
}

function countPreviousItemsOfType({
  state,
  type,
}: {
  state: ListState<ParseResultToken>;
  type: Token;
}) {
  const itemKeys = [...state.collection.getKeys()];
  const currentIndex = itemKeys.indexOf(state.selectionManager.focusedKey);

  return itemKeys.slice(0, currentIndex).reduce<number>((count, next) => {
    if (next.toString().includes(type)) {
      return count + 1;
    }
    return count;
  }, 0);
}

function calculateNextFocusForFilter(state: ListState<ParseResultToken>): FocusOverride {
  const numPreviousFilterItems = countPreviousItemsOfType({state, type: Token.FILTER});

  return {
    itemKey: `${Token.FILTER}:${numPreviousFilterItems}`,
    part: 'value',
  };
}

function calculateNextFocusForParen(item: Node<ParseResultToken>): FocusOverride {
  const [, tokenTypeIndexStr] = item.key.toString().split(':');

  const tokenTypeIndex = parseInt(tokenTypeIndexStr, 10);

  return {
    itemKey: `${Token.FREE_TEXT}:${tokenTypeIndex + 1}`,
  };
}

function useSortItems({
  filterValue,
}: {
  filterValue: string;
}): Array<KeySectionItem | KeyItem> {
  const {filterKeys, filterKeySections, getFieldDefinition} = useSearchQueryBuilder();
  const flatItems = useMemo<KeyItem[]>(
    () =>
      Object.values(filterKeys).map(filterKey =>
        createItem(filterKey, getFieldDefinition(filterKey.key))
      ),
    [filterKeys, getFieldDefinition]
  );
  const search = useFuzzySearch(flatItems, FUZZY_SEARCH_OPTIONS);

  return useMemo(() => {
    if (!filterValue || !search) {
      if (!filterKeySections.length) {
        return flatItems;
      }
      return filterKeySections.map(section =>
        createSection(section, filterKeys, getFieldDefinition)
      );
    }

    return search.search(filterValue).map(({item}) => item);
  }, [filterKeySections, filterKeys, filterValue, flatItems, getFieldDefinition, search]);
}

function KeyDescription({tag}: {tag: Tag}) {
  const {getFieldDefinition} = useSearchQueryBuilder();

  const fieldDefinition = getFieldDefinition(tag.key);

  if (!fieldDefinition || !fieldDefinition.desc) {
    return null;
  }

  return (
    <DescriptionWrapper>
      <div>{fieldDefinition.desc}</div>
      <Separator />
      <DescriptionList>
        {tag.alias ? (
          <Fragment>
            <Term>{t('Alias')}</Term>
            <Details>{tag.key}</Details>
          </Fragment>
        ) : null}
        {fieldDefinition.valueType ? (
          <Fragment>
            <Term>{t('Type')}</Term>
            <Details>{toTitleCase(fieldDefinition.valueType)}</Details>
          </Fragment>
        ) : null}
      </DescriptionList>
    </DescriptionWrapper>
  );
}

function SearchQueryBuilderInputInternal({
  item,
  token,
  tabIndex,
  state,
  rowRef,
}: SearchQueryBuilderInputInternalProps) {
  const organization = useOrganization();
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedTokenValue = token.text.trim();
  const [inputValue, setInputValue] = useState(trimmedTokenValue);
  const [selectionIndex, setSelectionIndex] = useState(0);

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(inputRef.current?.selectionStart ?? 0);
  }, []);

  const resetInputValue = useCallback(() => {
    setInputValue(trimmedTokenValue);
    updateSelectionIndex();
  }, [trimmedTokenValue, updateSelectionIndex]);

  const filterValue = getWordAtCursorPosition(inputValue, selectionIndex);

  const {
    query,
    filterKeys,
    filterKeySections,
    dispatch,
    getFieldDefinition,
    handleSearch,
    placeholder,
    searchSource,
    savedSearchType,
  } = useSearchQueryBuilder();

  const items = useSortItems({filterValue});

  // When token value changes, reset the input value
  const [prevValue, setPrevValue] = useState(inputValue);
  if (trimmedTokenValue !== prevValue) {
    setPrevValue(trimmedTokenValue);
    setInputValue(trimmedTokenValue);
  }

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      updateSelectionIndex();

      // Default combobox behavior stops events from propagating outside of input
      // Certain keys like ctrl+z and ctrl+a are handled in useQueryBuilderGrid()
      // so we need to continue propagation for those.
      if (isCtrlKeyPressed(e)) {
        if (e.key === 'z') {
          // First let native undo behavior take place, but once that is done
          // allow the event to propagate so that the grid can handle it.
          if (inputValue === trimmedTokenValue) {
            e.continuePropagation();
          }
        } else if (e.key === 'a') {
          e.continuePropagation();
        }
      }

      // At start and pressing backspace, focus the previous full token
      if (
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === 0 &&
        e.key === 'Backspace'
      ) {
        if (state.collection.getKeyBefore(item.key)) {
          state.selectionManager.setFocusedKey(state.collection.getKeyBefore(item.key));
        }
      }

      // At end and pressing delete, focus the next full token
      if (
        e.currentTarget.selectionStart === e.currentTarget.value.length &&
        e.currentTarget.selectionEnd === e.currentTarget.value.length &&
        e.key === 'Delete'
      ) {
        if (state.collection.getKeyAfter(item.key)) {
          state.selectionManager.setFocusedKey(state.collection.getKeyAfter(item.key));
        }
      }
    },
    [
      inputValue,
      item.key,
      state.collection,
      state.selectionManager,
      trimmedTokenValue,
      updateSelectionIndex,
    ]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const text = e.clipboardData.getData('text/plain').replace('\n', '').trim();

      dispatch({
        type: 'REPLACE_TOKENS_WITH_TEXT',
        tokens: [token],
        text,
      });
      resetInputValue();
    },
    [dispatch, resetInputValue, token]
  );

  const onClick = useCallback(() => {
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  return (
    <SearchQueryBuilderCombobox
      ref={inputRef}
      items={items}
      placeholder={query === '' ? placeholder : undefined}
      onOptionSelected={value => {
        dispatch({
          type: 'UPDATE_FREE_TEXT',
          tokens: [token],
          text: replaceFocusedWordWithFilter(
            inputValue,
            selectionIndex,
            value,
            getFieldDefinition
          ),
          focusOverride: calculateNextFocusForFilter(state),
        });
        resetInputValue();
        const selectedKey = filterKeys[value];
        trackAnalytics('search.key_autocompleted', {
          organization,
          search_type: savedSearchType === 0 ? 'issues' : 'events',
          search_source: searchSource,
          item_name: value,
          item_kind: selectedKey?.kind ?? FieldKind.FIELD,
          item_value_type: getFieldDefinition(value)?.valueType ?? FieldValueType.STRING,
          filtered: Boolean(filterValue),
          new_experience: true,
        });
      }}
      onCustomValueBlurred={value => {
        dispatch({type: 'UPDATE_FREE_TEXT', tokens: [token], text: value});
        resetInputValue();
      }}
      onCustomValueCommitted={value => {
        dispatch({type: 'UPDATE_FREE_TEXT', tokens: [token], text: value});
        resetInputValue();

        // Because the query does not change until a subsequent render,
        // we need to do the replacement that is does in the reducer here
        handleSearch(replaceTokensWithPadding(query, [token], value));
      }}
      onExit={() => {
        if (inputValue !== token.value.trim()) {
          dispatch({type: 'UPDATE_FREE_TEXT', tokens: [token], text: inputValue});
          resetInputValue();
        }
      }}
      inputValue={inputValue}
      token={token}
      inputLabel={t('Add a search term')}
      onInputChange={e => {
        if (e.target.value.includes('(') || e.target.value.includes(')')) {
          dispatch({
            type: 'UPDATE_FREE_TEXT',
            tokens: [token],
            text: e.target.value,
            focusOverride: calculateNextFocusForParen(item),
          });
          resetInputValue();
          return;
        }

        if (e.target.value.includes(':')) {
          dispatch({
            type: 'UPDATE_FREE_TEXT',
            tokens: [token],
            text: e.target.value,
            focusOverride: calculateNextFocusForFilter(state),
          });
          resetInputValue();
          return;
        }

        setInputValue(e.target.value);
        setSelectionIndex(e.target.selectionStart ?? 0);
      }}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      maxOptions={50}
      onPaste={onPaste}
      displayTabbedMenu={inputValue.length === 0 && filterKeySections.length > 0}
      shouldFilterResults={false}
      shouldCloseOnInteractOutside={el => {
        if (rowRef.current?.contains(el)) {
          return false;
        }
        return true;
      }}
      onClick={onClick}
    >
      {keyItem =>
        isSection(keyItem) ? (
          <Section title={keyItem.title} key={keyItem.key}>
            {keyItem.options.map(child => (
              <Item {...child} key={child.key}>
                {child.label}
              </Item>
            ))}
          </Section>
        ) : (
          <Item {...keyItem} key={keyItem.key}>
            {keyItem.label}
          </Item>
        )
      }
    </SearchQueryBuilderCombobox>
  );
}

/**
 * Takes a freeText token and renders a combobox which can be used for modifying
 * the text value or creating new filters.
 */
export function SearchQueryBuilderFreeText({
  token,
  state,
  item,
}: SearchQueryBuilderInputProps) {
  const ref = useRef<HTMLDivElement>(null);

  const {rowProps, gridCellProps} = useQueryBuilderGridItem(item, state, ref);
  const {shiftFocusProps} = useShiftFocusToChild(item, state);

  const isFocused = item.key === state.selectionManager.focusedKey;

  return (
    <Row {...mergeProps(rowProps, shiftFocusProps)} ref={ref} tabIndex={-1}>
      <GridCell {...gridCellProps} onClick={e => e.stopPropagation()}>
        <SearchQueryBuilderInputInternal
          item={item}
          state={state}
          token={token}
          tabIndex={isFocused ? 0 : -1}
          rowRef={ref}
        />
      </GridCell>
    </Row>
  );
}

const Row = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 24px;
  max-width: 100%;

  &:last-child {
    flex-grow: 1;
  }

  &[aria-selected='true'] {
    &::before {
      content: '';
      position: absolute;
      left: ${space(0.5)};
      right: ${space(0.5)};
      top: 0;
      bottom: 0;
      background-color: ${p => p.theme.gray100};
    }
  }

  input {
    &::selection {
      background-color: ${p => p.theme.gray100};
    }
  }
`;

const GridCell = styled('div')`
  display: flex;
  align-items: stretch;
  height: 100%;
  width: 100%;

  input {
    padding: 0 ${space(0.5)};
    min-width: 9px;
    width: 100%;
  }
`;

const DescriptionWrapper = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  max-width: 220px;
`;

const Separator = styled('hr')`
  border-top: 1px solid ${p => p.theme.border};
  margin: ${space(1)} 0;
`;

const DescriptionList = styled('dl')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)};
  margin: 0;
`;

const Term = styled('dt')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const Details = styled('dd')``;
