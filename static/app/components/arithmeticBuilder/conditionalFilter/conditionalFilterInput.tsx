import type {ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent} from 'react';
import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {Item, Section} from '@react-stately/collections';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';

import {
  ensureSearchFilterArgument,
  isFilterKeySuggestion,
  replaceConditionalFilterClause,
  unwrapSearchFilterArgument,
} from 'sentry/components/arithmeticBuilder/conditionalFilter/conditionalFilter';
import {useConditionalFilterAutocomplete} from 'sentry/components/arithmeticBuilder/conditionalFilter/conditionalFilterAutocomplete';
import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import {
  ArgumentGridCell,
  ArgumentGridRow,
  useFunctionArgumentInput,
  type FunctionArgumentInputProps,
} from 'sentry/components/arithmeticBuilder/token/useFunctionArgumentInput';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {ComboBox} from 'sentry/components/tokenizedInput/token/comboBox';
import {t} from 'sentry/locale';

export function ConditionalFilterArgumentInput(props: FunctionArgumentInputProps) {
  const {argument, argumentIndex, onArgumentsChange} = props;
  const {
    clearSkipBlurFlush,
    commitFunctionToken,
    dataTestId,
    flushArgumentsIfLeavingGrid,
    focusArgument,
    gridCellProps,
    gridCellRef,
    inputRef,
    isFocused,
    onKeyDown,
    onKeyDownCapture,
    rowProps,
    shouldCloseOnInteractOutside,
  } = useFunctionArgumentInput(props);

  const {functionArguments: builderFunctionArguments, getFilterTagValues} =
    useArithmeticBuilder();

  const initialLabel = unwrapSearchFilterArgument(argument.label);
  const [inputValue, setInputValue] = useState('');
  const [currentValue, setCurrentValue] = useState(initialLabel);
  const [isCurrentlyEditing, setIsCurrentlyEditing] = useState(false);
  const [selectionIndex, setSelectionIndex] = useState(0);
  const displayValue = isCurrentlyEditing ? inputValue : currentValue;
  // Apply after React commits the controlled value. A lone rAF + focus() races in
  // Chrome and resets the caret before (or when) focus returns from the listbox.
  const pendingCaretRef = useRef<{pos: number; value: string} | null>(null);
  const clickSelectionRafRef = useRef<number | null>(null);

  const {comboBoxFilterValue, editPhase, items} = useConditionalFilterAutocomplete({
    enabled: isCurrentlyEditing,
    filterValue: inputValue,
    functionArguments: builderFunctionArguments,
    getFilterTagValues,
    selectionIndex,
  });

  useLayoutEffect(() => {
    const pendingCaret = pendingCaretRef.current;
    if (pendingCaret === null) {
      return;
    }
    const input = inputRef.current;
    if (input?.value !== pendingCaret.value) {
      return;
    }
    pendingCaretRef.current = null;
    if (document.activeElement !== input) {
      input.focus();
    }
    input.setSelectionRange(pendingCaret.pos, pendingCaret.pos);
    setSelectionIndex(pendingCaret.pos);
  }, [inputRef, inputValue]);

  // Suggestion updates re-render the controlled input and can reset the DOM caret.
  // Keep a collapsed caret aligned with selectionIndex so key↔value autocomplete stays
  // correct. Never collapse an active text range (select-all + Backspace must stay in
  // the argument, not delete the whole function).
  useLayoutEffect(() => {
    if (!isCurrentlyEditing) {
      return;
    }
    const input = inputRef.current;
    if (!input || document.activeElement !== input) {
      return;
    }
    if (input.selectionStart !== input.selectionEnd) {
      return;
    }
    if (
      input.selectionStart === selectionIndex &&
      input.selectionEnd === selectionIndex
    ) {
      return;
    }
    input.setSelectionRange(selectionIndex, selectionIndex);
  }, [displayValue, inputRef, isCurrentlyEditing, items, selectionIndex]);

  const shouldFilterComboBoxResults = !(editPhase === 'value' && getFilterTagValues);

  const updateSelectionIndex = useCallback(
    (input?: HTMLInputElement | null) => {
      const target = input ?? inputRef.current;
      setSelectionIndex(target?.selectionStart ?? 0);
    },
    [inputRef]
  );

  const resetInputValue = useCallback(() => {
    setInputValue('');
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const onClick = useCallback(
    (evt: MouseEvent<HTMLInputElement>) => {
      const input = evt.currentTarget;
      if (clickSelectionRafRef.current !== null) {
        window.cancelAnimationFrame(clickSelectionRafRef.current);
      }
      // Read the caret after the browser places it; cancel if keyUp/change updates first.
      clickSelectionRafRef.current = window.requestAnimationFrame(() => {
        clickSelectionRafRef.current = null;
        updateSelectionIndex(input);
      });
    },
    [updateSelectionIndex]
  );

  const onKeyUp = useCallback(
    (evt: KeyboardEvent<HTMLInputElement>) => {
      if (clickSelectionRafRef.current !== null) {
        window.cancelAnimationFrame(clickSelectionRafRef.current);
        clickSelectionRafRef.current = null;
      }
      updateSelectionIndex(evt.currentTarget);
    },
    [updateSelectionIndex]
  );

  const onInputChange = useCallback((evt: ChangeEvent<HTMLInputElement>) => {
    if (clickSelectionRafRef.current !== null) {
      window.cancelAnimationFrame(clickSelectionRafRef.current);
      clickSelectionRafRef.current = null;
    }
    setInputValue(evt.target.value);
    setCurrentValue(evt.target.value);
    setSelectionIndex(evt.target.selectionStart ?? 0);
  }, []);

  const onInputEscape = useCallback(() => {
    resetInputValue();
    setIsCurrentlyEditing(false);
  }, [resetInputValue]);

  const onInputFocus = useCallback(
    (evt: FocusEvent<HTMLInputElement>) => {
      evt.stopPropagation();
      clearSkipBlurFlush();
      focusArgument();
      setIsCurrentlyEditing(true);
      setInputValue(currentValue);
      updateSelectionIndex(evt.currentTarget);
    },
    [clearSkipBlurFlush, currentValue, focusArgument, updateSelectionIndex]
  );

  // Persist free-text filter edits on blur. Empty input becomes `` so clearing the filter
  // updates argsRef (otherwise the prior value is kept and commitArgumentsIfChanged no-ops).
  // Skip REPLACE_TOKEN while focus stays inside the arguments grid — that remounts the
  // function and steals focus from the next arg. Pending edits flush via onArgumentsBlur.
  const onInputBlur = useCallback(
    (evt?: FocusEvent<HTMLInputElement>) => {
      const value = ensureSearchFilterArgument(inputValue);
      setCurrentValue(unwrapSearchFilterArgument(value));
      onArgumentsChange(argumentIndex, value);
      resetInputValue();
      setIsCurrentlyEditing(false);
      flushArgumentsIfLeavingGrid(evt);
    },
    [
      argumentIndex,
      flushArgumentsIfLeavingGrid,
      inputValue,
      onArgumentsChange,
      resetInputValue,
    ]
  );

  const onInputCommit = useCallback(() => {
    // Filter args may intentionally be cleared; don't fall back to the prior label.
    const value = ensureSearchFilterArgument(inputValue.trim());
    setCurrentValue(unwrapSearchFilterArgument(value));
    onArgumentsChange(argumentIndex, value);
    commitFunctionToken(value);
    resetInputValue();
  }, [
    argumentIndex,
    commitFunctionToken,
    inputValue,
    onArgumentsChange,
    resetInputValue,
  ]);

  const onOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      const {newValue, newCursorIndex} = replaceConditionalFilterClause(
        inputValue,
        selectionIndex,
        option.value
      );
      if (isFilterKeySuggestion(option.value)) {
        pendingCaretRef.current = {pos: newCursorIndex, value: newValue};
      }
      setCurrentValue(newValue);
      setInputValue(newValue);
      setIsCurrentlyEditing(true);
      setSelectionIndex(newCursorIndex);
    },
    [inputValue, selectionIndex]
  );

  return (
    <ArgumentGridRow {...rowProps} tabIndex={isFocused ? 0 : -1} ref={gridCellRef}>
      <ArgumentGridCell {...gridCellProps}>
        <ComboBox
          items={items}
          ref={inputRef}
          placeholder={unwrapSearchFilterArgument(argument.label)}
          inputLabel={t('Add a filter')}
          inputValue={displayValue}
          filterValue={comboBoxFilterValue}
          keepMenuOpenOnSelect={option => isFilterKeySuggestion(option.value)}
          shouldFilterResults={shouldFilterComboBoxResults}
          tabIndex={isFocused ? 0 : -1}
          shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
          onClick={onClick}
          onInputBlur={onInputBlur}
          onInputChange={onInputChange}
          onInputCommit={onInputCommit}
          onInputEscape={onInputEscape}
          onInputFocus={onInputFocus}
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
          onInputKeyUp={onKeyUp}
          onOptionSelected={onOptionSelected}
          data-test-id={dataTestId}
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
      </ArgumentGridCell>
    </ArgumentGridRow>
  );
}
