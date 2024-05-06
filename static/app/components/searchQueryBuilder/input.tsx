import {useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {getFocusableTreeWalker} from '@react-aria/focus';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {getItemsWithKeys} from 'sentry/components/compactSelect/utils';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/combobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/useQueryBuilderGridItem';
import type {
  ParseResultToken,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';

type SearchQueryBuilderInputProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
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
 * Replaces the focused word (at cursorPosition) with the selected filter key.
 *
 * Example:
 * replaceFocusedWordWithFilter('before brow after', 9, 'browser.name') => 'before browser.name: after'
 */
function replaceFocusedWordWithFilter(
  value: string,
  cursorPosition: number,
  key: string
) {
  const words = value.split(' ');

  let characterCount = 0;
  for (const word of words) {
    characterCount += word.length + 1;
    if (characterCount >= cursorPosition) {
      return (
        value.slice(0, characterCount - word.length - 1).trim() +
        ` ${key}: ` +
        value.slice(characterCount).trim()
      ).trim();
    }
  }

  return value;
}

function SearchQueryBuilderInputInternal({token}: SearchQueryBuilderInputProps) {
  const [inputValue, setInputValue] = useState(token.value.trim());
  // TODO(malwilley): Use input ref to update cursor position on mount
  const [selectionIndex, setSelectionIndex] = useState(0);

  const resetInputValue = () => {
    setInputValue(token.value.trim());
    // TODO(malwilley): Reset cursor position using ref
  };

  const filterValue = getWordAtCursorPosition(inputValue, selectionIndex);

  const {keys, dispatch} = useSearchQueryBuilder();

  const allKeys = useMemo(() => {
    return Object.values(keys);
  }, [keys]);

  const items = useMemo(() => {
    return getItemsWithKeys(
      allKeys.map(tag => {
        const fieldDefinition = getFieldDefinition(tag.key);

        return {
          label: fieldDefinition?.kind === FieldKind.FIELD ? tag.name : tag.key,
          value: tag.key,
          textValue: tag.key,
          hideCheck: true,
        };
      })
    );
  }, [allKeys]);

  // When token value changes, reset the input value
  const [prevValue, setPrevValue] = useState(token.value);
  if (token.value.trim() !== prevValue) {
    setPrevValue(token.value.trim());
    setInputValue(token.value.trim());
  }

  return (
    <SearchQueryBuilderCombobox
      items={items}
      onOptionSelected={value => {
        dispatch({
          type: 'UPDATE_FREE_TEXT',
          token,
          text: replaceFocusedWordWithFilter(inputValue, selectionIndex, value),
        });
        resetInputValue();
      }}
      onCustomValueSelected={value => {
        dispatch({type: 'UPDATE_FREE_TEXT', token, text: value});
      }}
      onExit={() => {
        if (inputValue !== token.value.trim()) {
          dispatch({type: 'UPDATE_FREE_TEXT', token, text: inputValue});
        }
      }}
      inputValue={inputValue}
      filterValue={filterValue}
      token={token}
      inputLabel={t('Add a search term')}
      onInputChange={e => {
        if (e.target.value.includes(':')) {
          dispatch({type: 'UPDATE_FREE_TEXT', token, text: e.target.value});
          resetInputValue();
        } else {
          setInputValue(e.target.value);
          setSelectionIndex(e.target.selectionStart ?? 0);
        }
      }}
    >
      <Section>
        {items.map(item => (
          <Item {...item} key={item.key}>
            {item.label}
          </Item>
        ))}
      </Section>
    </SearchQueryBuilderCombobox>
  );
}

export function SearchQueryBuilderInput({
  token,
  state,
  item,
}: SearchQueryBuilderInputProps) {
  const ref = useRef<HTMLDivElement>(null);

  const {rowProps, gridCellProps} = useQueryBuilderGridItem(item, state, ref);

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement, Element>) => {
      // Ensure that the state is updated correctly
      state.selectionManager.setFocusedKey(item.key);

      // When this row gains focus, immediately shift focus to the input
      const walker = getFocusableTreeWalker(e.currentTarget);
      const nextNode = walker.nextNode();
      if (nextNode) {
        (nextNode as HTMLElement).focus();
      }
    },
    [item.key, state.selectionManager]
  );

  return (
    <Row
      {...mergeProps(rowProps, {onFocus})}
      ref={ref}
      tabIndex={-1} // Input row should not be focused directly
    >
      <GridCell {...gridCellProps} onClick={e => e.stopPropagation()}>
        <SearchQueryBuilderInputInternal token={token} item={item} state={state} />
      </GridCell>
    </Row>
  );
}

const Row = styled('div')`
  display: flex;
  align-items: stretch;
  height: 22px;
`;

const GridCell = styled('div')`
  display: flex;
  align-items: stretch;
  height: 100%;

  input {
    padding: 0 ${space(0.5)};
    min-width: 9px;
  }
`;
