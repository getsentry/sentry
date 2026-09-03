import type {
  ChangeEventHandler,
  ClipboardEvent,
  FocusEvent,
  FocusEventHandler,
  MouseEventHandler,
  Ref,
} from 'react';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaComboBoxProps} from '@react-aria/combobox';
import {mergeRefs} from '@react-aria/utils';
import {useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren, Key, KeyboardEvent} from '@react-types/shared';

import type {
  SelectOptionOrSectionWithKey,
  SelectOptionWithKey,
} from '@sentry/scraps/compactSelect';
import {
  getDisabledOptions,
  getHiddenOptions,
  itemIsSectionWithKey,
  ListBox,
} from '@sentry/scraps/compactSelect';
import {Input, useAutosizeInput} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

import {Overlay} from 'sentry/components/overlay';
import {useSearchTokenCombobox} from 'sentry/components/searchQueryBuilder/tokens/useSearchTokenCombobox';
import {useOverlay} from 'sentry/utils/useOverlay';

interface ComboBoxProps {
  children: CollectionChildren<SelectOptionOrSectionWithKey<string>>;
  filterValue: string;
  inputLabel: string;
  inputValue: string;
  items: Array<SelectOptionOrSectionWithKey<string>>;
  ['data-test-id']?: string;
  /**
   * Keep the suggestion menu open after selecting an option. Useful when the
   * user still needs to pick a follow-up value (e.g. filter key → filter value).
   */
  keepMenuOpenOnSelect?: boolean | ((option: SelectOptionWithKey<string>) => boolean);
  onClick?: MouseEventHandler<HTMLInputElement>;
  onInputBlur?: (evt?: FocusEvent<HTMLInputElement>) => void;
  onInputChange?: ChangeEventHandler<HTMLInputElement>;
  onInputCommit?: (value: string) => void;
  onInputEscape?: () => void;
  onInputFocus?: FocusEventHandler<HTMLInputElement>;
  onKeyDown?: (evt: KeyboardEvent) => void;
  onKeyDownCapture?: (evt: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  onOpenChange?: (newOpenState: boolean) => void;
  onOptionSelected?: (option: SelectOptionWithKey<string>) => void;
  onPaste?: (e: ClipboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
  /**
   * Function to determine whether the menu should close when interacting with
   * other elements.
   */
  shouldCloseOnInteractOutside?: (interactedElement: Element) => boolean;
  /**
   * When false, all items from `items` are shown and filtering is left to the caller.
   */
  shouldFilterResults?: boolean;
  tabIndex?: number;
}

function useHiddenItems({
  items,
  filterValue,
  maxOptions,
  shouldFilterResults,
}: {
  filterValue: string;
  items: Array<SelectOptionOrSectionWithKey<string>>;
  maxOptions?: number;
  shouldFilterResults?: boolean;
}) {
  const hiddenOptions = useMemo(() => {
    const {hidden} = getHiddenOptions(
      items,
      shouldFilterResults ? filterValue : '',
      maxOptions
    );
    return hidden;
  }, [items, shouldFilterResults, filterValue, maxOptions]);

  const disabledKeys = useMemo(
    () => [...getDisabledOptions(items), ...hiddenOptions],
    [hiddenOptions, items]
  );

  return {
    hiddenOptions,
    disabledKeys,
  };
}

export function ComboBox({
  children,
  inputLabel,
  inputValue,
  items,
  shouldCloseOnInteractOutside,
  onClick,
  onInputBlur,
  onInputCommit,
  onInputEscape,
  onInputFocus,
  onOpenChange,
  onOptionSelected,
  'data-test-id': dataTestId,
  filterValue,
  onInputChange,
  onKeyDown,
  onKeyDownCapture,
  onKeyUp,
  onPaste,
  placeholder,
  tabIndex,
  ref,
  keepMenuOpenOnSelect,
  shouldFilterResults = true,
}: ComboBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const openMenuRef = useRef<(() => void) | null>(null);
  const closeMenuRef = useRef<(() => void) | null>(null);
  const suppressAutoOpenRef = useRef(false);

  const {hiddenOptions, disabledKeys} = useHiddenItems({
    items,
    filterValue,
    maxOptions: 50,
    shouldFilterResults,
  });

  const hasVisibleItems = items.some(item => {
    if (itemIsSectionWithKey(item)) {
      return item.options.some(option => !hiddenOptions.has(option.key));
    }
    return !hiddenOptions.has(item.key);
  });

  const shouldKeepMenuOpenOnSelect = useCallback(
    (option: SelectOptionWithKey<string>) => {
      if (typeof keepMenuOpenOnSelect === 'function') {
        return keepMenuOpenOnSelect(option);
      }
      return keepMenuOpenOnSelect ?? false;
    },
    [keepMenuOpenOnSelect]
  );

  const applyOptionSelection = useCallback(
    (option: SelectOptionWithKey<string>) => {
      onOptionSelected?.(option);
      if (shouldKeepMenuOpenOnSelect(option)) {
        openMenuRef.current?.();
        return;
      }
      if (keepMenuOpenOnSelect === undefined) {
        return;
      }
      // Selecting closes the menu and briefly suppresses auto-open so focus/click
      // returning to the input does not immediately reopen it.
      suppressAutoOpenRef.current = true;
      requestAnimationFrame(() => {
        closeMenuRef.current?.();
        requestAnimationFrame(() => {
          suppressAutoOpenRef.current = false;
        });
      });
    },
    [keepMenuOpenOnSelect, onOptionSelected, shouldKeepMenuOpenOnSelect]
  );

  const handleValueChange = useCallback(
    (key: Key | null) => {
      if (!key) {
        return;
      }

      for (const item of items) {
        if (itemIsSectionWithKey(item)) {
          const option = item.options.find(child => child.key === key);
          if (option) {
            applyOptionSelection(option);
            break;
          }
        } else if (item.key === key) {
          applyOptionSelection(item);
          break;
        }
      }
    },
    [applyOptionSelection, items]
  );

  const comboBoxProps: Partial<AriaComboBoxProps<SelectOptionOrSectionWithKey<string>>> =
    {
      items,
      autoFocus: false,
      inputValue: filterValue,
      onChange: handleValueChange,
      allowsCustomValue: true,
      disabledKeys,
      isDisabled: false,
      value: null,
    };

  const state = useComboBoxState<SelectOptionOrSectionWithKey<string>>({
    children,
    allowsEmptyCollection: true,
    // We handle closing on blur ourselves to prevent the combobox from closing
    // when the user clicks inside the custom menu
    shouldCloseOnBlur: false,
    ...comboBoxProps,
  });
  openMenuRef.current = () => state.open();
  closeMenuRef.current = () => state.close();

  const handleComboBoxFocus: FocusEventHandler<HTMLInputElement> = useCallback(
    evt => {
      onInputFocus?.(evt);
      if (suppressAutoOpenRef.current) {
        return;
      }
      state.open();
    },
    [onInputFocus, state]
  );

  const handleComboBoxBlur: FocusEventHandler<HTMLInputElement> = useCallback(
    evt => {
      if (evt.relatedTarget && !shouldCloseOnInteractOutside?.(evt.relatedTarget)) {
        return;
      }
      onInputBlur?.(evt);
      state.close();
    },
    [onInputBlur, shouldCloseOnInteractOutside, state]
  );

  // Showing the overlay with nothing to select renders as an empty grey bar
  const isOpen = state.isOpen && hasVisibleItems;
  const isMenuVisible = isOpen;

  const handleComboBoxKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      onKeyDown?.(evt);
      switch (evt.key) {
        case 'Escape':
          evt.stopPropagation();
          state.close();
          state.setFocused(false);
          onInputEscape?.();
          return;
        case 'Enter':
          if (isOpen && state.selectionManager.focusedKey) {
            return;
          }
          state.close();
          state.setFocused(false);
          onInputCommit?.(inputValue);
          return;
        default:
          return;
      }
    },
    [inputValue, onInputCommit, onInputEscape, state, isOpen, onKeyDown]
  );

  const handleComboBoxKeyUp = useCallback(
    (evt: KeyboardEvent) => {
      onKeyUp?.(evt);
    },
    [onKeyUp]
  );

  const {inputProps, listBoxProps} = useSearchTokenCombobox<
    SelectOptionOrSectionWithKey<string>
  >(
    {
      ...comboBoxProps,
      'aria-label': inputLabel,
      listBoxRef,
      inputRef,
      popoverRef,
      shouldFocusWrap: true,
      onFocus: handleComboBoxFocus,
      onBlur: handleComboBoxBlur,
      onKeyDown: handleComboBoxKeyDown,
      onKeyUp: handleComboBoxKeyUp,
    },
    state
  );

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [onOpenChange, isOpen]);

  const handleShouldCloseOnInteractOutside = useCallback(
    (el: Element) => {
      if (popoverRef.current?.contains(el)) {
        return false;
      }

      return shouldCloseOnInteractOutside?.(el) ?? true;
    },
    [shouldCloseOnInteractOutside]
  );

  const handleOnInteractOutside = useCallback(() => {
    onInputBlur?.();
    state.close();
  }, [onInputBlur, state]);

  const {
    overlayProps,
    triggerProps,
    update: updateOverlayPosition,
  } = useOverlay({
    type: 'listbox',
    isOpen,
    position: 'bottom-start',
    offset: [-12, 12],
    isKeyboardDismissDisabled: true,
    shouldCloseOnBlur: true,
    shouldCloseOnInteractOutside: handleShouldCloseOnInteractOutside,
    onInteractOutside: handleOnInteractOutside,
    shouldApplyMinWidth: false,
    preventOverflowOptions: {boundary: document.body},
    flipOptions: {
      // We don't want the menu to ever flip to the other side of the input
      fallbackPlacements: [],
    },
  });

  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    evt => {
      evt.stopPropagation();
      inputProps.onClick?.(evt);
      onClick?.(evt);
      if (suppressAutoOpenRef.current) {
        return;
      }
      state.open();
    },
    [inputProps, state, onClick]
  );

  useUpdateOverlayPositionOnContentChange({
    contentRef: popoverRef,
    updateOverlayPosition,
    isOpen,
  });

  const autosizeInputRef = useAutosizeInput({value: inputValue});

  return (
    <Flex align="stretch" width="100%" height="100%" position="relative">
      <UnstyledInput
        {...inputProps}
        size="md"
        ref={mergeRefs(
          ref,
          inputRef,
          autosizeInputRef,
          triggerProps.ref as React.Ref<HTMLInputElement>
        )}
        type="text"
        placeholder={placeholder}
        onClick={handleInputClick}
        value={inputValue}
        onChange={onInputChange ?? (() => {})}
        tabIndex={tabIndex}
        onPaste={onPaste}
        disabled={false}
        onKeyDownCapture={onKeyDownCapture}
        data-test-id={dataTestId}
      />
      <StyledPositionWrapper
        {...overlayProps}
        hidden={!isMenuVisible}
        visible={isMenuVisible}
        style={{
          ...overlayProps.style,
          display: isMenuVisible ? overlayProps.style?.display : 'none',
        }}
      >
        <ListBoxOverlay ref={popoverRef}>
          <ListBox
            {...listBoxProps}
            ref={listBoxRef}
            listState={state}
            hasSearch={!!filterValue}
            hiddenOptions={hiddenOptions}
            overlayIsOpen={isMenuVisible}
            size="sm"
          />
        </ListBoxOverlay>
      </StyledPositionWrapper>
    </Flex>
  );
}

// The menu size can change from things like loading states, long options,
// or custom menus like a date picker. This hook ensures that the overlay
// is updated in response to these changes.
function useUpdateOverlayPositionOnContentChange({
  contentRef,
  updateOverlayPosition,
  isOpen,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  updateOverlayPosition: (() => void) | null;
}) {
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Keep a ref to the updateOverlayPosition function so that we can
  // access the latest value in the resize observer callback.
  const updateOverlayPositionRef = useRef(updateOverlayPosition);
  if (updateOverlayPositionRef.current !== updateOverlayPosition) {
    updateOverlayPositionRef.current = updateOverlayPosition;
  }

  useLayoutEffect(() => {
    resizeObserverRef.current = new ResizeObserver(() => {
      if (!updateOverlayPositionRef.current) {
        return;
      }
      updateOverlayPositionRef.current?.();
    });

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!contentRef.current || !resizeObserverRef.current || !isOpen) {
      return () => {};
    }

    resizeObserverRef.current?.observe(contentRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [contentRef, isOpen, updateOverlayPosition]);
}

const UnstyledInput = styled(Input)`
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

const StyledPositionWrapper = styled('div')<{visible?: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
  z-index: ${p => p.theme.zIndex.tooltip};
`;

const ListBoxOverlay = styled(Overlay)`
  max-height: 400px;
  min-width: 200px;
  width: 600px;
  max-width: min-content;
  overflow-y: auto;
`;
