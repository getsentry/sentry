import {Fragment, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent, Node} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderGridItem';
import {replaceTokensWithPadding} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {useFilterKeyListBox} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/useFilterKeyListBox';
import {InvalidTokenTooltip} from 'sentry/components/searchQueryBuilder/tokens/invalidTokenTooltip';
import {useSortedFilterKeyItems} from 'sentry/components/searchQueryBuilder/tokens/useSortedFilterKeyItems';
import {
  getInitialFilterText,
  itemIsSection,
  useShiftFocusToChild,
} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {
  FieldDefinitionGetter,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import {
  collapseTextTokens,
  parseTokenKey,
  recentSearchTypeToLabel,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  InvalidReason,
  type ParseResultToken,
  parseSearch,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import useOrganization from 'sentry/utils/useOrganization';

type SearchQueryBuilderInputProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FREE_TEXT>;
};

type SearchQueryBuilderInputInternalProps = {
  item: Node<ParseResultToken>;
  rowRef: React.RefObject<HTMLDivElement>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FREE_TEXT>;
};

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

/**
 * Replaces the focused word (at cursorPosition) with the given text.
 */
function replaceFocusedWord(value: string, cursorPosition: number, replacement: string) {
  const words = value.split(' ');

  let characterCount = 0;
  for (const word of words) {
    characterCount += word.length + 1;
    if (characterCount >= cursorPosition) {
      return (
        value.slice(0, characterCount - word.length - 1).trim() +
        ` ${replacement} ` +
        value.slice(characterCount).trim()
      ).trim();
    }
  }

  return value;
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
  return replaceFocusedWord(
    value,
    cursorPosition,
    getInitialFilterText(key, getFieldDefinition(key))
  );
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

function calculateNextFocusForInsertedToken(item: Node<ParseResultToken>): FocusOverride {
  const {index} = parseTokenKey(item.key.toString());

  return {
    itemKey: `${Token.FREE_TEXT}:${index + 1}`,
  };
}

function calculateNextFocusForCommittedCustomValue({
  value,
  currentFocusedKey,
}: {
  currentFocusedKey: string;
  value: string;
}): FocusOverride | undefined {
  const {tokenType, index} = parseTokenKey(currentFocusedKey.toString());

  const parsedText = collapseTextTokens(parseSearch(value));
  const numFreeTextTokens = Math.max(
    parsedText?.filter((token: any) => token.type === Token.FREE_TEXT).length ?? 0
  );

  // We always expect there to be at least one free text token, so we subtract one
  // to get the index of the next token to focus.
  const diff = Math.max(0, numFreeTextTokens - 1);

  if (diff <= 0) {
    return undefined;
  }

  return {
    itemKey: `${tokenType}:${index + diff}`,
  };
}

function shouldHideInvalidTooltip({
  token,
  inputValue,
  isOpen,
}: {
  inputValue: string;
  isOpen: boolean;
  token: TokenResult<Token.FREE_TEXT>;
}) {
  if (!token.invalid || isOpen) {
    return true;
  }

  switch (token.invalid.type) {
    case InvalidReason.FREE_TEXT_NOT_ALLOWED:
      return inputValue === '';
    case InvalidReason.WILDCARD_NOT_ALLOWED:
      return !inputValue.includes('*');
    default:
      return false;
  }
}

// Because the text input may be larger than the actual text, we use a hidden div
// with the same text content to measure the width of the text. This is used for
// centering the invalid tooltip, as well as for placing the selection background.
function HiddenText({
  token,
  state,
  item,
  inputValue,
  isOpen,
}: {
  inputValue: string;
  isOpen: boolean;
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FREE_TEXT>;
}) {
  return (
    <PositionedTooltip
      state={state}
      token={token}
      item={item}
      forceVisible={
        shouldHideInvalidTooltip({token, inputValue, isOpen}) ? false : undefined
      }
      skipWrapper={false}
    >
      <InvisibleText aria-hidden data-hidden-text>
        {inputValue}
      </InvisibleText>
    </PositionedTooltip>
  );
}

function SearchQueryBuilderInputInternal({
  item,
  token,
  state,
  rowRef,
}: SearchQueryBuilderInputInternalProps) {
  const organization = useOrganization();
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedTokenValue = token.text.trim();
  const [isOpen, setIsOpen] = useState(false);
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
    dispatch,
    getFieldDefinition,
    handleSearch,
    placeholder,
    searchSource,
    recentSearches,
  } = useSearchQueryBuilder();

  const {customMenu, sectionItems, maxOptions, onKeyDownCapture} = useFilterKeyListBox({
    filterValue,
  });
  const sortedFilteredItems = useSortedFilterKeyItems({
    filterValue,
    inputValue,
    includeSuggestions: true,
  });

  const items = customMenu ? sectionItems : sortedFilteredItems;

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
      const {selectionStart, selectionEnd} = inputRef.current ?? {};
      const currentText = inputRef.current?.value ?? '';

      const allTextSelected = selectionStart === 0 && selectionEnd === currentText.length;

      // If there is text and there is a custom selection, use default paste behavior
      if (currentText.trim() && !allTextSelected) {
        return;
      }

      // Otherwise, we want to parse the clipboard text and replace the current token with it
      e.preventDefault();
      e.stopPropagation();

      const clipboardText = e.clipboardData
        .getData('text/plain')
        .replace('\n', '')
        .trim();

      dispatch({
        type: 'REPLACE_TOKENS_WITH_TEXT',
        tokens: [token],
        text: clipboardText,
      });
      resetInputValue();
    },
    [dispatch, resetInputValue, token]
  );

  const onClick = useCallback(() => {
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  return (
    <Fragment>
      <HiddenText
        token={token}
        state={state}
        item={item}
        inputValue={inputValue}
        isOpen={isOpen}
      />
      <SearchQueryBuilderCombobox
        customMenu={customMenu}
        ref={inputRef}
        items={items}
        placeholder={query === '' ? placeholder : undefined}
        onOptionSelected={option => {
          if (option.type === 'recent-query') {
            dispatch({
              type: 'UPDATE_QUERY',
              query: option.value,
              focusOverride: {itemKey: 'end'},
            });
            handleSearch(option.value);
            return;
          }

          if (option.type === 'raw-search') {
            dispatch({type: 'UPDATE_FREE_TEXT', tokens: [token], text: option.value});
            resetInputValue();

            // Because the query does not change until a subsequent render,
            // we need to do the replacement that is does in the reducer here
            handleSearch(replaceTokensWithPadding(query, [token], option.value));
            return;
          }

          if (option.type === 'filter-value' && option.textValue) {
            dispatch({
              type: 'UPDATE_FREE_TEXT',
              tokens: [token],
              text: replaceFocusedWord(inputValue, selectionIndex, option.textValue),
              focusOverride: calculateNextFocusForInsertedToken(item),
            });
            resetInputValue();
            return;
          }

          const value = option.value;

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
            search_type: recentSearchTypeToLabel(recentSearches),
            search_source: searchSource,
            item_name: value,
            item_kind: selectedKey?.kind ?? FieldKind.FIELD,
            item_value_type:
              getFieldDefinition(value)?.valueType ?? FieldValueType.STRING,
            filtered: Boolean(filterValue),
            new_experience: true,
          });
        }}
        onCustomValueBlurred={value => {
          dispatch({
            type: 'UPDATE_FREE_TEXT',
            tokens: [token],
            text: value,
            focusOverride: calculateNextFocusForCommittedCustomValue({
              currentFocusedKey: item.key.toString(),
              value,
            }),
          });
          resetInputValue();
        }}
        onCustomValueCommitted={value => {
          dispatch({
            type: 'UPDATE_FREE_TEXT',
            tokens: [token],
            text: value,
            focusOverride: calculateNextFocusForCommittedCustomValue({
              currentFocusedKey: item.key.toString(),
              value,
            }),
          });
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
          // Parse text to see if this keystroke would have created any tokens.
          // Add a trailing quote in case the user wants to wrap with quotes.
          const parsedText = parseSearch(e.target.value + '"');

          if (
            parsedText?.some(
              textToken =>
                textToken.type === Token.L_PAREN || textToken.type === Token.R_PAREN
            )
          ) {
            dispatch({
              type: 'UPDATE_FREE_TEXT',
              tokens: [token],
              text: e.target.value,
              focusOverride: calculateNextFocusForInsertedToken(item),
            });
            resetInputValue();
            return;
          }

          if (
            parsedText?.some(
              textToken =>
                textToken.type === Token.FILTER && textToken.key.text === filterValue
            )
          ) {
            const filterKey = filterValue;
            const key = filterKeys[filterKey];
            dispatch({
              type: 'UPDATE_FREE_TEXT',
              tokens: [token],
              text: replaceFocusedWordWithFilter(
                inputValue,
                selectionIndex,
                filterKey,
                getFieldDefinition
              ),
              focusOverride: calculateNextFocusForFilter(state),
            });
            resetInputValue();
            trackAnalytics('search.key_manually_typed', {
              organization,
              search_type: recentSearchTypeToLabel(recentSearches),
              search_source: searchSource,
              item_name: filterKey,
              item_kind: key?.kind ?? FieldKind.FIELD,
              item_value_type:
                getFieldDefinition(filterKey)?.valueType ?? FieldValueType.STRING,
              new_experience: true,
            });
            return;
          }

          setInputValue(e.target.value);
          setSelectionIndex(e.target.selectionStart ?? 0);
        }}
        onKeyDown={onKeyDown}
        onKeyDownCapture={onKeyDownCapture}
        onOpenChange={setIsOpen}
        tabIndex={item.key === state.selectionManager.focusedKey ? 0 : -1}
        maxOptions={maxOptions}
        onPaste={onPaste}
        shouldFilterResults={false}
        shouldCloseOnInteractOutside={el => {
          if (rowRef.current?.contains(el)) {
            return false;
          }
          return true;
        }}
        onClick={onClick}
        data-test-id={
          state.collection.getLastKey() === item.key ? 'query-builder-input' : undefined
        }
      >
        {keyItem =>
          itemIsSection(keyItem) ? (
            <Section title={keyItem.label} key={keyItem.key}>
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
    </Fragment>
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

  const isInvalid = Boolean(token.invalid);

  return (
    <Row
      {...mergeProps(rowProps, shiftFocusProps)}
      ref={ref}
      tabIndex={-1}
      aria-invalid={isInvalid}
    >
      <GridCell {...gridCellProps} onClick={e => e.stopPropagation()}>
        <SearchQueryBuilderInputInternal
          item={item}
          state={state}
          token={token}
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

  &[aria-invalid='true'] {
    input {
      color: ${p => p.theme.red400};
    }
  }

  &[aria-selected='true'] {
    [data-hidden-text='true']::before {
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
  position: relative;
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

const PositionedTooltip = styled(InvalidTokenTooltip)`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
`;

const InvisibleText = styled('div')`
  position: relative;
  color: transparent;
  padding: 0 ${space(0.5)};
  min-width: 9px;
  height: 100%;
`;
