import {type Key, type MouseEventHandler, useCallback, useMemo, useRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useComboBox} from '@react-aria/combobox';
import {useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren} from '@react-types/shared';

import {ListBox} from 'sentry/components/compactSelect/listBox';
import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {
  getDisabledOptions,
  getEscapedKey,
  getHiddenOptions,
} from 'sentry/components/compactSelect/utils';
import {GrowingInput} from 'sentry/components/growingInput';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import mergeRefs from 'sentry/utils/mergeRefs';
import useOverlay from 'sentry/utils/useOverlay';

type SearchQueryBuilderComboboxProps = {
  children: CollectionChildren<SelectOptionWithKey<string>>;
  inputLabel: string;
  inputValue: string;
  items: SelectOptionWithKey<string>[];
  onCustomValueSelected: (value: string) => void;
  onOptionSelected: (value: string) => void;
  token: TokenResult<Token>;
  autoFocus?: boolean;
  filterValue?: string;
  onExit?: () => void;
  onInputChange?: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
};

export function SearchQueryBuilderCombobox({
  children,
  items,
  inputValue,
  filterValue = inputValue,
  placeholder,
  onCustomValueSelected,
  onOptionSelected,
  inputLabel,
  onExit,
  onKeyDown,
  onInputChange,
  autoFocus,
}: SearchQueryBuilderComboboxProps) {
  const theme = useTheme();
  const listBoxRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hiddenOptions = useMemo(() => {
    return getHiddenOptions(items, filterValue, 10);
  }, [items, filterValue]);

  const disabledKeys = useMemo(
    () => [...getDisabledOptions(items), ...hiddenOptions].map(getEscapedKey),
    [hiddenOptions, items]
  );

  const onSelectionChange = useCallback(
    (key: Key) => {
      const selectedOption = items.find(item => item.key === key);
      if (selectedOption) {
        onOptionSelected(selectedOption.textValue ?? '');
      } else if (key) {
        onOptionSelected(key.toString());
      }
    },
    [items, onOptionSelected]
  );

  const state = useComboBoxState<SelectOptionWithKey<string>>({
    children,
    items,
    autoFocus,
    inputValue: filterValue,
    onSelectionChange,
    disabledKeys,
  });
  const {inputProps, listBoxProps} = useComboBox<SelectOptionWithKey<string>>(
    {
      'aria-label': inputLabel,
      listBoxRef,
      inputRef,
      popoverRef,
      items,
      inputValue: filterValue,
      onSelectionChange,
      autoFocus,
      onBlur: () => {
        if (inputValue) {
          onCustomValueSelected(inputValue);
        } else {
          onExit?.();
        }
        state.close();
      },
      onKeyDown: e => {
        onKeyDown?.(e);
        switch (e.key) {
          case 'Escape':
            state.close();
            onExit?.();
            return;
          case 'Enter':
            if (!state.inputValue || state.selectionManager.focusedKey) {
              return;
            }
            state.close();
            onCustomValueSelected(inputValue);
            return;
          default:
            return;
        }
      },
    },
    state
  );

  const isOpen = state.isOpen && hiddenOptions.size < items.length;

  const {overlayProps, triggerProps} = useOverlay({
    type: 'listbox',
    isOpen,
    position: 'bottom-start',
    offset: [0, 8],
    isKeyboardDismissDisabled: true,
    shouldCloseOnBlur: true,
    onInteractOutside: () => {
      if (state.inputValue) {
        onCustomValueSelected(inputValue);
      } else {
        onExit?.();
      }
      state.close();
    },
  });

  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    e => {
      e.stopPropagation();
      inputProps.onClick?.(e);
      state.open();
    },
    [inputProps, state]
  );

  return (
    <Wrapper>
      <UnstyledInput
        {...inputProps}
        size="md"
        ref={mergeRefs([inputRef, triggerProps.ref])}
        type="text"
        placeholder={placeholder}
        onClick={handleInputClick}
        value={inputValue}
        onChange={onInputChange}
      />
      <StyledPositionWrapper
        {...overlayProps}
        zIndex={theme.zIndex?.tooltip}
        visible={isOpen}
      >
        <Overlay ref={popoverRef}>
          <ListBox
            {...listBoxProps}
            ref={listBoxRef}
            listState={state}
            hasSearch={!!filterValue}
            hiddenOptions={hiddenOptions}
            keyDownHandler={() => true}
            overlayIsOpen={isOpen}
            size="md"
          />
        </Overlay>
      </StyledPositionWrapper>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
`;

const UnstyledInput = styled(GrowingInput)`
  background: transparent;
  border: none;
  box-shadow: none;
  flex-grow: 1;
  padding: 0;
  height: auto;
  min-height: auto;
  resize: none;
  min-width: 1px;
  border-radius: 0;

  &:focus {
    outline: none;
    border: none;
    box-shadow: none;
  }
`;

const StyledPositionWrapper = styled(PositionWrapper, {
  shouldForwardProp: prop => isPropValid(prop),
})<{visible?: boolean}>`
  min-width: 100%;
  display: ${p => (p.visible ? 'block' : 'none')};
`;
