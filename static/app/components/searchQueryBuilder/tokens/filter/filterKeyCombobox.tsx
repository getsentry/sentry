import {useCallback, useRef, useState} from 'react';
import {Item} from '@react-stately/collections';
import type {Node} from '@react-types/shared';

import {Flex} from '@sentry/scraps/layout';

import {
  useSearchQueryBuilderConfig,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {getFilterValueType} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import type {SearchKeyItem} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {useSortedFilterKeyItems} from 'sentry/components/searchQueryBuilder/tokens/useSortedFilterKeyItems';
import {
  getInitialFilterText,
  resolveFilterKey,
} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {
  ParseResultToken,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyLabel, getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {FieldKey, FieldKind} from 'sentry/utils/fields';

type KeyComboboxProps = {
  item: Node<ParseResultToken>;
  onCommit: () => void;
  token: TokenResult<Token.FILTER>;
};

export function FilterKeyCombobox({token, onCommit, item}: KeyComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(getKeyLabel(token.key) ?? '');

  const {items: sortedFilterKeys, isLoading} = useSortedFilterKeyItems({
    filterValue: inputValue,
    inputValue,
    includeSuggestions: false,
  });
  const {filterKeys, getFieldDefinition, getSuggestedFilterKey} =
    useSearchQueryBuilderConfig();
  const {dispatch, pendingFilterKey} = useSearchQueryBuilderState();
  const isPending = pendingFilterKey === item.key;

  // Closing the key editor moves focus out of the filter, which would give a
  // pending filter its placeholder value, so go back to its value instead.
  const closeEditor = useCallback(() => {
    if (isPending) {
      dispatch({
        type: 'SET_FOCUS_OVERRIDE',
        focusOverride: {itemKey: item.key.toString(), part: 'value'},
      });
    }
    onCommit();
  }, [dispatch, isPending, item.key, onCommit]);

  const currentFilterValueType = getFilterValueType(
    token,
    getFieldDefinition(getKeyName(token.key))
  );

  const handleSelectKey = useCallback(
    (keyName: string) => {
      const newFieldDef = getFieldDefinition(keyName);
      const newFilterValueType = getFilterValueType(token, newFieldDef);

      if (keyName === getKeyName(token.key)) {
        closeEditor();
        return;
      }

      if (
        newFilterValueType === currentFilterValueType &&
        // IS and HAS filters are strings, but treated differently and will break
        // if we preserve the value.
        keyName !== FieldKey.IS &&
        keyName !== FieldKey.HAS &&
        // Array attributes need the `[*]` membership operator, which only
        // getInitialFilterText adds — so don't swap the key in place.
        newFieldDef?.kind !== FieldKind.ARRAY
      ) {
        dispatch({
          type: 'UPDATE_FILTER_KEY',
          token,
          key: keyName,
          // A filter without a value stays pending
          shouldCommitQuery: !isPending,
        });
        closeEditor();
        return;
      }

      dispatch({
        type: 'REPLACE_TOKENS_WITH_TEXT_ON_SELECT',
        tokens: [token],
        text: getInitialFilterText(keyName, newFieldDef),
        focusOverride: {
          itemKey: item.key.toString(),
          part: 'value',
        },
      });

      onCommit();
    },
    [
      closeEditor,
      currentFilterValueType,
      dispatch,
      getFieldDefinition,
      isPending,
      item.key,
      onCommit,
      token,
    ]
  );

  const onOptionSelected = useCallback(
    (option: SearchKeyItem) => {
      handleSelectKey(option.value);
    },
    [handleSelectKey]
  );

  const onValueCommitted = useCallback(
    (keyName: string) => {
      const trimmedKeyName = keyName.trim();

      if (!trimmedKeyName) {
        closeEditor();
        return;
      }

      handleSelectKey(
        resolveFilterKey({
          key: trimmedKeyName,
          filterKeys,
          getSuggestedFilterKey,
          loadedItems: sortedFilterKeys,
        })
      );
    },
    [closeEditor, filterKeys, getSuggestedFilterKey, handleSelectKey, sortedFilterKeys]
  );

  const onCustomValueBlurred = useCallback(() => {
    onCommit();
  }, [onCommit]);

  const onExit = useCallback(() => {
    closeEditor();
  }, [closeEditor]);

  return (
    <Flex align="center" paddingLeft="2xs" maxWidth="400px" height="100%">
      <SearchQueryBuilderCombobox
        ref={inputRef}
        items={sortedFilterKeys}
        isLoading={isLoading}
        onOptionSelected={onOptionSelected}
        onCustomValueCommitted={onValueCommitted}
        onCustomValueBlurred={onCustomValueBlurred}
        onExit={onExit}
        inputValue={inputValue}
        placeholder={getKeyLabel(token.key)}
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
    </Flex>
  );
}
