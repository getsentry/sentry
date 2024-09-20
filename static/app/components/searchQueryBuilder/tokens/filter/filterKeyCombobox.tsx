import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Item} from '@react-stately/collections';
import type {Node} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {getFilterValueType} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import type {SearchKeyItem} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {useSortedFilterKeyItems} from 'sentry/components/searchQueryBuilder/tokens/useSortedFilterKeyItems';
import {getInitialFilterText} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {
  ParseResultToken,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FieldKey} from 'sentry/utils/fields';

type KeyComboboxProps = {
  item: Node<ParseResultToken>;
  onCommit: () => void;
  token: TokenResult<Token.FILTER>;
};

export function FilterKeyCombobox({token, onCommit, item}: KeyComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const sortedFilterKeys = useSortedFilterKeyItems({
    filterValue: inputValue,
    inputValue,
    includeSuggestions: false,
  });
  const {dispatch, getFieldDefinition} = useSearchQueryBuilder();

  const currentFilterValueType = getFilterValueType(
    token,
    getFieldDefinition(getKeyName(token.key))
  );

  const handleSelectKey = useCallback(
    (keyName: string) => {
      const newFieldDef = getFieldDefinition(keyName);
      const newFilterValueType = getFilterValueType(token, newFieldDef);

      if (keyName === getKeyName(token.key)) {
        onCommit();
        return;
      }

      if (
        newFilterValueType === currentFilterValueType &&
        // IS and HAS filters are strings, but treated differently and will break
        // if we prevserve the value.
        keyName !== FieldKey.IS &&
        keyName !== FieldKey.HAS
      ) {
        dispatch({
          type: 'UPDATE_FILTER_KEY',
          token,
          key: keyName,
        });
        onCommit();
        return;
      }

      dispatch({
        type: 'REPLACE_TOKENS_WITH_TEXT',
        tokens: [token],
        text: getInitialFilterText(keyName, newFieldDef),
        focusOverride: {
          itemKey: item.key.toString(),
          part: 'value',
        },
      });

      onCommit();
    },
    [currentFilterValueType, dispatch, getFieldDefinition, item.key, onCommit, token]
  );

  const onOptionSelected = useCallback(
    (option: SearchKeyItem) => {
      handleSelectKey(option.value);
    },
    [handleSelectKey]
  );

  const onCustomValueBlurred = useCallback(() => {
    onCommit();
  }, [onCommit]);

  const onExit = useCallback(() => {
    onCommit();
  }, [onCommit]);

  return (
    <EditingWrapper>
      <SearchQueryBuilderCombobox
        ref={inputRef}
        items={sortedFilterKeys}
        placeholder={getKeyName(token.key)}
        onOptionSelected={onOptionSelected}
        onCustomValueCommitted={handleSelectKey}
        onCustomValueBlurred={onCustomValueBlurred}
        onExit={onExit}
        inputValue={inputValue}
        token={token}
        inputLabel={t('Edit filter key')}
        onInputChange={e => setInputValue(e.target.value)}
        maxOptions={50}
        shouldFilterResults={false}
        autoFocus
        openOnFocus
      >
        {keyItem => (
          <Item {...keyItem} key={keyItem.key}>
            {keyItem.label}
          </Item>
        )}
      </SearchQueryBuilderCombobox>
    </EditingWrapper>
  );
}

const EditingWrapper = styled('div')`
  display: flex;
  height: 100%;
  align-items: center;
  max-width: 400px;
  padding-left: ${space(0.25)};
`;
