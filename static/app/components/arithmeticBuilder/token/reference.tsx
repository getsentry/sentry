import type {ChangeEvent} from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent, Node} from '@react-types/shared';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token, TokenReference} from 'sentry/components/arithmeticBuilder/token';
import {TokenKind} from 'sentry/components/arithmeticBuilder/token';
import {DeleteButton} from 'sentry/components/arithmeticBuilder/token/deleteButton';
import {
  GridCell,
  LeftGridCell,
  Row,
} from 'sentry/components/arithmeticBuilder/token/styles';
import {nextTokenKeyOfKind} from 'sentry/components/arithmeticBuilder/tokenizer';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {ComboBox} from 'sentry/components/tokenizedInput/token/comboBox';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

interface ArithmeticBuilderTokenReferenceProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenReference;
}

export function ArithmeticBuilderTokenReference({
  item,
  state,
  token,
}: ArithmeticBuilderTokenReferenceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: true,
  });

  return (
    <Row
      {...rowProps}
      ref={ref}
      tabIndex={-1}
      aria-label={token.label}
      aria-invalid={false}
      withBorder
    >
      <LeftGridCell {...gridCellProps}>
        <InternalInput item={item} state={state} token={token} rowRef={ref} />
      </LeftGridCell>
      <GridCell {...gridCellProps}>
        <DeleteReference token={token} item={item} state={state} />
      </GridCell>
    </Row>
  );
}

interface InternalInputProps extends ArithmeticBuilderTokenReferenceProps {
  rowRef: React.RefObject<HTMLDivElement | null>;
}

function InternalInput({item, state, token, rowRef}: InternalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [currentValue, setCurrentValue] = useState(token.label);
  const [isCurrentlyEditing, setIsCurrentlyEditing] = useState(false);

  // Sync currentValue when the token changes (e.g. key reuse after re-tokenization)
  const [prevLabel, setPrevLabel] = useState(token.label);
  if (token.label !== prevLabel) {
    setPrevLabel(token.label);
    setCurrentValue(token.label);
  }

  const filterValue = inputValue.trim();
  const displayValue = isCurrentlyEditing ? inputValue : currentValue;

  const {dispatch, references} = useArithmeticBuilder();

  const items = useMemo(() => {
    const refList = references ? [...references] : [];
    const filtered = filterValue
      ? refList.filter(key => key.toLowerCase().includes(filterValue.toLowerCase()))
      : refList;
    return [
      {
        key: 'references',
        label: t('references'),
        options: filtered.map(key => ({
          key: `${TokenKind.REFERENCE}:${key}`,
          label: key,
          value: key,
          textValue: key,
          hideCheck: true,
        })),
      },
    ];
  }, [references, filterValue]);

  const shouldCloseOnInteractOutside = useCallback(
    (el: Element) => !rowRef.current?.contains(el),
    [rowRef]
  );

  const onInputBlur = useCallback(() => {
    setInputValue('');
    setIsCurrentlyEditing(false);
  }, []);

  const onInputChange = useCallback((evt: ChangeEvent<HTMLInputElement>) => {
    setInputValue(evt.target.value);
  }, []);

  const onInputCommit = useCallback(() => {
    const value = inputValue.trim() || token.label;
    setCurrentValue(value);
    dispatch({
      text: value,
      type: 'REPLACE_TOKEN',
      token,
      focusOverride: {
        itemKey: nextTokenKeyOfKind(state, token, TokenKind.FREE_TEXT),
      },
    });
    setInputValue('');
    setIsCurrentlyEditing(false);
  }, [dispatch, state, token, inputValue]);

  const onInputEscape = useCallback(() => {
    setInputValue('');
    setIsCurrentlyEditing(false);
  }, []);

  const onInputFocus = useCallback((_evt: React.FocusEvent<HTMLInputElement>) => {
    setIsCurrentlyEditing(true);
    setInputValue('');
  }, []);

  const onKeyDownCapture = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'ArrowLeft'
      ) {
        focusTarget(state, state.collection.getKeyBefore(item.key));
        return;
      }

      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'ArrowRight'
      ) {
        focusTarget(state, state.collection.getKeyAfter(item.key));
        return;
      }
    },
    [state, item]
  );

  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'Backspace'
      ) {
        const itemKey = state.collection.getKeyBefore(item.key);
        dispatch({
          type: 'DELETE_TOKEN',
          token,
          focusOverride: defined(itemKey) ? {itemKey} : undefined,
        });
      }

      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'Delete'
      ) {
        const itemKey = state.collection.getKeyAfter(item.key);
        dispatch({
          type: 'DELETE_TOKEN',
          token,
          focusOverride: defined(itemKey) ? {itemKey} : undefined,
        });
      }
    },
    [dispatch, token, state, item]
  );

  const onOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      setCurrentValue(option.value);
      dispatch({
        text: option.value,
        type: 'REPLACE_TOKEN',
        token,
        focusOverride: {
          itemKey: nextTokenKeyOfKind(state, token, TokenKind.FREE_TEXT),
        },
      });
      setInputValue('');
      setIsCurrentlyEditing(false);
    },
    [dispatch, state, token]
  );

  return (
    <ComboBox
      ref={inputRef}
      items={items}
      placeholder={token.label}
      inputLabel={t('Select a reference')}
      inputValue={displayValue}
      filterValue={filterValue}
      tabIndex={item.key === state.selectionManager.focusedKey ? 0 : -1}
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
      onInputBlur={onInputBlur}
      onInputChange={onInputChange}
      onInputCommit={onInputCommit}
      onInputEscape={onInputEscape}
      onInputFocus={onInputFocus}
      onKeyDown={onKeyDown}
      onKeyDownCapture={onKeyDownCapture}
      onOptionSelected={onOptionSelected}
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
    </ComboBox>
  );
}

interface DeleteReferenceProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenReference;
}

function DeleteReference({token, item, state}: DeleteReferenceProps) {
  const itemKey = state.collection.getKeyBefore(item.key)?.toString() ?? null;

  return (
    <DeleteButton
      token={token}
      focusOverrideKey={itemKey}
      label={t('Remove reference %s', token.label)}
    />
  );
}
