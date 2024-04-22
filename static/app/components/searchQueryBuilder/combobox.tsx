import {
  type Key,
  type MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useComboBox} from '@react-aria/combobox';
import {useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren} from '@react-types/shared';

import {SelectContext} from 'sentry/components/compactSelect/control';
import {SelectFilterContext} from 'sentry/components/compactSelect/list';
import {ListBox} from 'sentry/components/compactSelect/listBox';
import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {getHiddenOptions} from 'sentry/components/compactSelect/utils';
import {GrowingInput} from 'sentry/components/growingInput';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {focusIsWithinToken} from 'sentry/components/searchQueryBuilder/utils';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import mergeRefs from 'sentry/utils/mergeRefs';
import useOverlay from 'sentry/utils/useOverlay';

type SearchQueryBuilderComboboxProps = {
  children: CollectionChildren<SelectOptionWithKey<string>>;
  inputLabel: string;
  inputValue: string;
  items: SelectOptionWithKey<string>[];
  onChange: (key: string) => void;
  onExit: () => void;
  placeholder: string;
  setInputValue: (value: string) => void;
  token: TokenResult<Token.FILTER>;
};

export function SearchQueryBuilderCombobox({
  children,
  items,
  inputValue,
  setInputValue,
  placeholder,
  onChange,
  token,
  inputLabel,
  onExit,
}: SearchQueryBuilderComboboxProps) {
  const theme = useTheme();
  const listBoxRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const {focus} = useSearchQueryBuilder();

  useEffect(() => {
    if (focusIsWithinToken(focus, token)) {
      inputRef.current?.focus();
    }
  }, [focus, token]);

  const hiddenOptions = useMemo(() => {
    return getHiddenOptions(items, inputValue, 10);
  }, [items, inputValue]);

  const onSelectionChange = useCallback(
    (key: Key) => {
      const selectedOption = items.find(item => item.key === key);
      if (selectedOption) {
        onChange(selectedOption.textValue ?? '');
      } else {
        onChange(key.toString());
      }
    },
    [items, onChange]
  );

  const state = useComboBoxState<SelectOptionWithKey<string>>({
    children,
    items,
    autoFocus: true,
    inputValue,
    onInputChange: setInputValue,
    onSelectionChange,
    onFocus: () => {
      state.open();
    },
  });
  const {inputProps, listBoxProps} = useComboBox<SelectOptionWithKey<string>>(
    {
      'aria-label': inputLabel,
      listBoxRef,
      inputRef,
      popoverRef,
      items,
      inputValue,
      onSelectionChange,
      onInputChange: setInputValue,
      autoFocus: true,
      onFocus: () => {
        state.open();
      },
      onBlur: () => {
        if (state.inputValue) {
          onChange(state.inputValue);
        } else {
          onExit();
        }
        state.close();
      },
      onKeyDown: e => {
        switch (e.key) {
          case 'Escape':
            state.close();
            onExit();
            return;
          case 'Enter':
            if (!state.inputValue || state.selectionManager.focusedKey) {
              return;
            }
            state.close();
            onChange(state.inputValue);
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
        onChange(state.inputValue);
      } else {
        onExit();
      }
      state.close();
    },
  });

  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    e => {
      inputProps.onClick?.(e);
      state.open();
    },
    [inputProps, state]
  );

  const selectContextValue = useMemo(
    () => ({
      search: inputValue,
      overlayIsOpen: isOpen,
      registerListState: () => {},
      saveSelectedOptions: () => {},
    }),
    [inputValue, isOpen]
  );

  return (
    <SelectContext.Provider value={selectContextValue}>
      <SelectFilterContext.Provider value={hiddenOptions}>
        <Wrapper>
          <UnstyledInput
            {...inputProps}
            size="md"
            ref={mergeRefs([inputRef, triggerProps.ref])}
            type="text"
            placeholder={placeholder}
            onClick={handleInputClick}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            autoFocus
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
                keyDownHandler={() => true}
                size="md"
              />
            </Overlay>
          </StyledPositionWrapper>
        </Wrapper>
      </SelectFilterContext.Provider>
    </SelectContext.Provider>
  );
}

const Wrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
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
  min-width: 10px;
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
