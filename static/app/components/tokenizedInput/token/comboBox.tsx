import type {
  ChangeEventHandler,
  FocusEventHandler,
  ForwardedRef,
  MouseEventHandler,
} from 'react';
import {forwardRef, useCallback, useEffect, useLayoutEffect, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaComboBoxProps} from '@react-aria/combobox';
import {useComboBox} from '@react-aria/combobox';
import {ariaHideOutside} from '@react-aria/overlays';
import {useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren, Key, KeyboardEvent} from '@react-types/shared';

import {ListBox} from 'sentry/components/compactSelect/listBox';
import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {GrowingInput} from 'sentry/components/growingInput';
import {Overlay} from 'sentry/components/overlay';
import {findItemInSections} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {defined} from 'sentry/utils';
import mergeRefs from 'sentry/utils/mergeRefs';
import useOverlay from 'sentry/utils/useOverlay';

interface ComboBoxProps<T extends SelectOptionWithKey<string>> {
  children: CollectionChildren<T>;
  filterValue: string;
  inputLabel: string;
  inputValue: string;
  items: T[];
  /**
   * Function to determine whether the menu should close when interacting with
   * other elements.
   */
  ['data-test-id']?: string;
  onClick?: MouseEventHandler<HTMLInputElement>;
  onInputBlur?: (value: string) => void;
  onInputChange?: ChangeEventHandler<HTMLInputElement>;
  onInputCommit?: (value: string) => void;
  onInputEscape?: () => void;
  onKeyDown?: (evt: KeyboardEvent) => void;
  onKeyDownCapture?: (evt: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  onOpenChange?: (newOpenState: boolean) => void;
  onOptionSelected?: (option: T) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  shouldCloseOnInteractOutside?: (interactedElement: Element) => boolean;
  tabIndex?: number;
}

function ComboBoxInner<T extends SelectOptionWithKey<string>>(
  {
    children,
    items,
    inputLabel,
    inputValue,
    shouldCloseOnInteractOutside,
    onClick,
    onInputBlur,
    onInputCommit,
    onInputEscape,
    onOpenChange,
    onOptionSelected,
    ['data-test-id']: dataTestId,
    filterValue,
    onInputChange,
    onKeyDown,
    onKeyDownCapture,
    onKeyUp,
    onPaste,
    placeholder,
    tabIndex,
  }: ComboBoxProps<T>,
  ref: ForwardedRef<HTMLInputElement>
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (!key) {
        return;
      }

      const selectedOption = findItemInSections(items, key);
      if (selectedOption) {
        onOptionSelected?.(selectedOption);
      }
    },
    [items, onOptionSelected]
  );

  const comboBoxProps: Partial<AriaComboBoxProps<T>> = {
    items,
    autoFocus: false,
    inputValue: filterValue,
    onSelectionChange: handleSelectionChange,
    allowsCustomValue: true,
    disabledKeys: [],
    isDisabled: false,
  };

  const state = useComboBoxState<T>({
    children,
    allowsEmptyCollection: true,
    // We handle closing on blur ourselves to prevent the combobox from closing
    // when the user clicks inside the custom menu
    shouldCloseOnBlur: false,
    ...comboBoxProps,
  });

  const handleComboBoxFocus: FocusEventHandler<HTMLInputElement> = useCallback(
    _evt => state.open(),
    [state]
  );

  const handleComboBoxBlur: FocusEventHandler<HTMLInputElement> = useCallback(
    evt => {
      if (evt.relatedTarget && !shouldCloseOnInteractOutside?.(evt.relatedTarget)) {
        return;
      }
      onInputBlur?.(inputValue);
      state.close();
    },
    [inputValue, onInputBlur, shouldCloseOnInteractOutside, state]
  );

  const isOpen = state.isOpen;

  const handleComboBoxKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      onKeyDown?.(evt);
      switch (evt.key) {
        case 'Escape':
          state.close();
          onInputEscape?.();
          return;
        case 'Enter':
          if (isOpen && state.selectionManager.focusedKey) {
            return;
          }
          state.close();
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

  const {inputProps, listBoxProps} = useComboBox<T>(
    {
      ...comboBoxProps,
      'aria-label': inputLabel,
      listBoxRef,
      inputRef,
      popoverRef,
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
    onInputBlur?.(inputValue);
    state.close();
  }, [inputValue, onInputBlur, state]);

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
      state.open();
    },
    [inputProps, state, onClick]
  );

  useUpdateOverlayPositionOnContentChange({
    contentRef: popoverRef,
    updateOverlayPosition,
    isOpen,
  });

  // useCombobox will hide outside elements with aria-hidden="true" when it is open [1].
  // Because we switch elements when a custom menu is displayed, we need to manually
  // call this function an extra time to ensure the correct elements are hidden.
  //
  // [1]: https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/combobox/src/useComboBox.ts#L337C3-L341C44
  useEffect(() => {
    if (isOpen) {
      return ariaHideOutside([inputRef.current, popoverRef.current].filter(defined));
    }

    return () => {};
  }, [isOpen]);

  return (
    <Wrapper>
      <UnstyledInput
        {...inputProps}
        size="md"
        ref={mergeRefs([ref, inputRef, triggerProps.ref])}
        type="text"
        placeholder={placeholder}
        onClick={handleInputClick}
        value={inputValue}
        onChange={onInputChange}
        tabIndex={tabIndex}
        onPaste={onPaste}
        disabled={false}
        onKeyDownCapture={onKeyDownCapture}
        data-test-id={dataTestId}
      />
      <StyledPositionWrapper {...overlayProps} visible={isOpen}>
        <ListBoxOverlay ref={popoverRef}>
          <ListBox
            {...listBoxProps}
            ref={listBoxRef}
            listState={state}
            hasSearch={!!filterValue}
            hiddenOptions={undefined}
            keyDownHandler={() => true}
            overlayIsOpen={isOpen}
            size="sm"
          />
        </ListBoxOverlay>
      </StyledPositionWrapper>
    </Wrapper>
  );
}

export const ComboBox = forwardRef(ComboBoxInner) as <
  T extends SelectOptionWithKey<string>,
>(
  props: ComboBoxProps<T> & {ref?: ForwardedRef<HTMLInputElement>}
) => ReturnType<typeof ComboBoxInner>;

// The menu size can change from things like loading states, long options,
// or custom menus like a date picker. This hook ensures that the overlay
// is updated in response to these changes.
function useUpdateOverlayPositionOnContentChange({
  contentRef,
  updateOverlayPosition,
  isOpen,
}: {
  contentRef: React.RefObject<HTMLDivElement>;
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

const Wrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
  width: 100%;
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
