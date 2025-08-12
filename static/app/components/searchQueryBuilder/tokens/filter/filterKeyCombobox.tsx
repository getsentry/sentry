import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Item} from '@react-stately/collections';
import type {ComboBoxState} from '@react-stately/combobox';
import type {KeyboardEvent, Node} from '@react-types/shared';

import {useSeerAcknowledgeMutation} from 'sentry/components/events/autofix/useSeerAcknowledgeMutation';
import {ASK_SEER_CONSENT_ITEM_KEY} from 'sentry/components/searchQueryBuilder/askSeer/askSeerConsentOption';
import {ASK_SEER_ITEM_KEY} from 'sentry/components/searchQueryBuilder/askSeer/askSeerOption';
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
import {getKeyLabel, getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FieldKey} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';

type KeyComboboxProps = {
  item: Node<ParseResultToken>;
  onCommit: () => void;
  token: TokenResult<Token.FILTER>;
};

export function FilterKeyCombobox({token, onCommit, item}: KeyComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(getKeyLabel(token.key) ?? '');

  const organization = useOrganization();
  const {mutate: seerAcknowledgeMutate} = useSeerAcknowledgeMutation();
  const sortedFilterKeys = useSortedFilterKeyItems({
    filterValue: inputValue,
    inputValue,
    includeSuggestions: false,
  });
  const {
    dispatch,
    getFieldDefinition,
    getSuggestedFilterKey,
    setDisplayAskSeer,
    currentInputValue,
    setAutoSubmitSeer,
  } = useSearchQueryBuilder();

  const currentFilterValueType = getFilterValueType(
    token,
    getFieldDefinition(getKeyName(token.key))
  );

  const handleSelectKey = useCallback(
    (keyName: string) => {
      const newFieldDef = getFieldDefinition(keyName);
      const newFilterValueType = getFilterValueType(token, newFieldDef);

      if (keyName === ASK_SEER_ITEM_KEY) {
        trackAnalytics('trace.explorer.ai_query_interface', {
          organization,
          action: 'opened',
        });
        setDisplayAskSeer(true);

        if (currentInputValue?.trim()) {
          setAutoSubmitSeer(true);
        } else {
          setAutoSubmitSeer(false);
        }

        return;
      }

      if (keyName === ASK_SEER_CONSENT_ITEM_KEY) {
        trackAnalytics('trace.explorer.ai_query_interface', {
          organization,
          action: 'consent_accepted',
        });
        seerAcknowledgeMutate();
        return;
      }

      if (keyName === getKeyName(token.key)) {
        onCommit();
        return;
      }

      if (
        newFilterValueType === currentFilterValueType &&
        // IS and HAS filters are strings, but treated differently and will break
        // if we preserve the value.
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
    [
      currentFilterValueType,
      currentInputValue,
      dispatch,
      getFieldDefinition,
      item.key,
      onCommit,
      organization,
      seerAcknowledgeMutate,
      setAutoSubmitSeer,
      setDisplayAskSeer,
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
        onCommit();
        return;
      }

      handleSelectKey(getSuggestedFilterKey(trimmedKeyName) ?? trimmedKeyName);
    },
    [handleSelectKey, getSuggestedFilterKey, onCommit]
  );

  const onCustomValueBlurred = useCallback(() => {
    onCommit();
  }, [onCommit]);

  const onExit = useCallback(() => {
    onCommit();
  }, [onCommit]);

  const keyUpCounter = useRef(0);
  const keyDownCounter = useRef(0);
  const onKeyDown = useCallback(
    (e: KeyboardEvent, {state}: {state: ComboBoxState<SearchKeyItem>}) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const firstKey = state.collection.getFirstKey();
        const lastKey = state.collection.getLastKey();
        const currentKey = state.selectionManager.focusedKey;

        if (currentKey === firstKey) {
          keyUpCounter.current++;
          keyDownCounter.current++;

          if (keyUpCounter.current >= 2) {
            keyUpCounter.current = 0;
            state.selectionManager.setFocusedKey(state.collection.getLastKey());
          }
        }
        // Case when user goes from input to last item
        else if (currentKey === lastKey && keyDownCounter.current === 0) {
          keyDownCounter.current = 2;
        } else {
          keyUpCounter.current = 0;
          keyDownCounter.current = 0;
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const firstKey = state.collection.getFirstKey();
        const lastKey = state.collection.getLastKey();
        const currentKey = state.selectionManager.focusedKey;

        if (currentKey === lastKey) {
          keyUpCounter.current++;
          keyDownCounter.current++;

          if (keyDownCounter.current >= 2) {
            keyDownCounter.current = 0;
            state.selectionManager.setFocusedKey(state.collection.getFirstKey());
          }
        }
        // case when user goes from input to first item
        else if (currentKey === firstKey && keyUpCounter.current === 0) {
          keyUpCounter.current = 2;
        } else {
          keyUpCounter.current = 0;
          keyDownCounter.current = 0;
        }
        return;
      }
    },
    []
  );

  return (
    <EditingWrapper>
      <SearchQueryBuilderCombobox
        ref={inputRef}
        items={sortedFilterKeys}
        onOptionSelected={onOptionSelected}
        onCustomValueCommitted={onValueCommitted}
        onCustomValueBlurred={onCustomValueBlurred}
        onKeyDown={onKeyDown}
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
    </EditingWrapper>
  );
}

const EditingWrapper = styled('div')`
  display: flex;
  height: 100%;
  align-items: center;
  max-width: 400px;
  padding-left: ${p => p.theme.space['2xs']};
`;
