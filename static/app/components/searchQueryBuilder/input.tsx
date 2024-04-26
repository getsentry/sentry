import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';

import {getItemsWithKeys} from 'sentry/components/compactSelect/utils';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/combobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {focusIsWithinToken} from 'sentry/components/searchQueryBuilder/utils';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';

type SearchQueryBuilderInputProps = {
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

export function SearchQueryBuilderInput({token}: SearchQueryBuilderInputProps) {
  const [inputValue, setInputValue] = useState(token.value.trim());
  // TODO(malwilley): Use input ref to update cursor position on mount
  const [selectionIndex, setSelectionIndex] = useState(0);

  const resetInputValue = () => {
    setInputValue(token.value.trim());
    // TODO(malwilley): Reset cursor position using ref
  };

  const filterValue = getWordAtCursorPosition(inputValue, selectionIndex);

  const {keys, dispatch, focus} = useSearchQueryBuilder();

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

  const isFocused = focusIsWithinToken(focus, token);

  useEffect(() => {
    setInputValue(token.value.trim());
  }, [token.value]);

  if (!isFocused) {
    return (
      <Inactive
        tabIndex={-1}
        role="row"
        aria-label={inputValue || t('Click to add a search term')}
        onClick={() =>
          dispatch({type: 'FOCUS_FREE_TEXT', cursor: token.location.start.offset})
        }
      >
        {inputValue}
      </Inactive>
    );
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
        resetInputValue();
      }}
      onExit={() => {
        if (inputValue !== token.value.trim()) {
          dispatch({type: 'UPDATE_FREE_TEXT', token, text: inputValue});
          resetInputValue();
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

const Inactive = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 ${space(0.5)};
  margin: 0 -${space(0.5)};
`;
