import {
  type ForwardedRef,
  forwardRef,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {usePopper} from 'react-popper';
import styled from '@emotion/styled';
import {type AriaComboBoxProps, useComboBox} from '@react-aria/combobox';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import {ariaHideOutside} from '@react-aria/overlays';
import {type ComboBoxState, useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren, Key, KeyboardEvent} from '@react-types/shared';

import {ListBox} from 'sentry/components/compactSelect/listBox';
import type {
  SelectKey,
  SelectOptionOrSectionWithKey,
  SelectOptionWithKey,
} from 'sentry/components/compactSelect/types';
import {
  getDisabledOptions,
  getHiddenOptions,
} from 'sentry/components/compactSelect/utils';
import {GrowingInput} from 'sentry/components/growingInput';
import {Overlay} from 'sentry/components/overlay';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {
  findItemInSections,
  itemIsSection,
} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import mergeRefs from 'sentry/utils/mergeRefs';
import useOverlay from 'sentry/utils/useOverlay';
import usePrevious from 'sentry/utils/usePrevious';

type SearchQueryBuilderComboboxProps<T extends SelectOptionOrSectionWithKey<string>> = {
  children: CollectionChildren<T>;
  inputLabel: string;
  inputValue: string;
  items: T[];
  /**
   * Called when the input is blurred.
   * Passes the current input value.
   */
  onCustomValueBlurred: (value: string) => void;
  /**
   * Called when the user commits a value with the enter key.
   * Passes the current input value.
   */
  onCustomValueCommitted: (value: string) => void;
  /**
   * Called when the user selects an option from the dropdown.
   * Passes the selected option.
   */
  onOptionSelected: (option: T) => void;
  token: TokenResult<Token>;
  autoFocus?: boolean;
  /**
   * Display an entirely custom menu.
   */
  customMenu?: CustomComboboxMenu<T>;
  ['data-test-id']?: string;
  /**
   * If the combobox has additional information to display, passing JSX
   * to this prop will display it in an overlay at the top left position.
   */
  description?: ReactNode;
  filterValue?: string;
  /**
   * When passing `isOpen`, the open state is controlled by the parent.
   */
  isOpen?: boolean;
  maxOptions?: number;
  onClick?: (e: React.MouseEvent) => void;
  /**
   * Called when the user explicitly closes the combobox with the escape key.
   */
  onExit?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onInputChange?: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: (e: KeyboardEvent, extra: {state: ComboBoxState<T>}) => void;
  onKeyDownCapture?: (
    e: React.KeyboardEvent<HTMLInputElement>,
    extra: {state: ComboBoxState<T>}
  ) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  onOpenChange?: (newOpenState: boolean) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  openOnFocus?: boolean;
  placeholder?: string;
  /**
   * Function to determine whether the menu should close when interacting with
   * other elements.
   */
  shouldCloseOnInteractOutside?: (interactedElement: Element) => boolean;
  /**
   * Whether the menu should filter results based on the filterValue.
   * Disable if the filtering should be handled by the caller.
   */
  shouldFilterResults?: boolean;
  tabIndex?: number;
};

type OverlayProps = ReturnType<typeof useOverlay>['overlayProps'];

export type CustomComboboxMenuProps<T> = {
  filterValue: string;
  hiddenOptions: Set<SelectKey>;
  isOpen: boolean;
  listBoxProps: AriaListBoxOptions<T>;
  listBoxRef: React.RefObject<HTMLUListElement>;
  overlayProps: OverlayProps;
  popoverRef: React.RefObject<HTMLDivElement>;
  state: ComboBoxState<T>;
};

export type CustomComboboxMenu<T> = (
  props: CustomComboboxMenuProps<T>
) => React.ReactNode;

const DESCRIPTION_POPPER_OPTIONS = {
  placement: 'top-start' as const,
  strategy: 'fixed' as const,
  modifiers: [
    {
      name: 'offset',
      options: {
        offset: [-12, 8],
      },
    },
  ],
};

function menuIsOpen({
  state,
  hiddenOptions,
  totalOptions,
  hasCustomMenu,
  isOpen,
}: {
  hiddenOptions: Set<SelectKey>;
  state: ComboBoxState<any>;
  totalOptions: number;
  hasCustomMenu?: boolean;
  isOpen?: boolean;
}) {
  const openState = isOpen ?? state.isOpen;

  if (hasCustomMenu) {
    return openState;
  }

  // When a custom menu is not being displayed and we aren't loading anything,
  // only show when there is something to select from.
  return openState && totalOptions > hiddenOptions.size;
}

function useHiddenItems<T extends SelectOptionOrSectionWithKey<string>>({
  items,
  filterValue,
  maxOptions,
  shouldFilterResults,
}: {
  filterValue: string;
  items: T[];
  maxOptions?: number;
  shouldFilterResults?: boolean;
}) {
  const hiddenOptions: Set<SelectKey> = useMemo(() => {
    return getHiddenOptions(items, shouldFilterResults ? filterValue : '', maxOptions);
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

function OverlayContent<T extends SelectOptionOrSectionWithKey<string>>({
  customMenu,
  filterValue,
  hiddenOptions,
  isOpen,
  listBoxProps,
  listBoxRef,
  popoverRef,
  state,
  overlayProps,
}: {
  filterValue: string;
  hiddenOptions: Set<SelectKey>;
  isOpen: boolean;
  listBoxProps: AriaListBoxOptions<any>;
  listBoxRef: React.RefObject<HTMLUListElement>;
  overlayProps: OverlayProps;
  popoverRef: React.RefObject<HTMLDivElement>;
  state: ComboBoxState<any>;
  customMenu?: CustomComboboxMenu<T>;
}) {
  if (customMenu) {
    return customMenu({
      popoverRef,
      listBoxRef,
      isOpen,
      hiddenOptions,
      listBoxProps,
      state,
      overlayProps,
      filterValue,
    });
  }

  return (
    <StyledPositionWrapper {...overlayProps} visible={isOpen}>
      <ListBoxOverlay ref={popoverRef}>
        <ListBox
          {...listBoxProps}
          ref={listBoxRef}
          listState={state}
          hasSearch={!!filterValue}
          hiddenOptions={hiddenOptions}
          keyDownHandler={() => true}
          overlayIsOpen={isOpen}
          size="sm"
        />
      </ListBoxOverlay>
    </StyledPositionWrapper>
  );
}

function SearchQueryBuilderComboboxInner<T extends SelectOptionOrSectionWithKey<string>>(
  {
    children,
    description,
    items,
    inputValue,
    filterValue = inputValue,
    placeholder,
    onCustomValueBlurred,
    onCustomValueCommitted,
    onOptionSelected,
    inputLabel,
    onExit,
    onKeyDown,
    onKeyDownCapture,
    onKeyUp,
    onInputChange,
    onOpenChange,
    autoFocus,
    openOnFocus,
    onFocus,
    tabIndex = -1,
    maxOptions,
    shouldFilterResults = true,
    shouldCloseOnInteractOutside,
    onPaste,
    onClick,
    customMenu,
    isOpen: incomingIsOpen,
    ['data-test-id']: dataTestId,
  }: SearchQueryBuilderComboboxProps<T>,
  ref: ForwardedRef<HTMLInputElement>
) {
  const {disabled} = useSearchQueryBuilder();
  const listBoxRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  const {hiddenOptions, disabledKeys} = useHiddenItems({
    items,
    filterValue,
    maxOptions,
    shouldFilterResults,
  });

  const onSelectionChange = useCallback(
    (key: Key | null) => {
      if (!key) {
        return;
      }

      const selectedOption = findItemInSections(items, key);
      if (selectedOption) {
        onOptionSelected(selectedOption);
      }
    },
    [items, onOptionSelected]
  );

  const comboBoxProps: Partial<AriaComboBoxProps<T>> = {
    items,
    autoFocus,
    inputValue: filterValue,
    onSelectionChange,
    allowsCustomValue: true,
    disabledKeys,
    isDisabled: disabled,
  };

  const state = useComboBoxState<T>({
    children,
    allowsEmptyCollection: true,
    // We handle closing on blur ourselves to prevent the combobox from closing
    // when the user clicks inside the custom menu
    shouldCloseOnBlur: false,
    ...comboBoxProps,
  });

  const {inputProps, listBoxProps} = useComboBox<T>(
    {
      ...comboBoxProps,
      'aria-label': inputLabel,
      listBoxRef,
      inputRef,
      popoverRef,
      onFocus: e => {
        if (openOnFocus) {
          state.open();
        }
        onFocus?.(e);
      },
      onBlur: e => {
        if (e.relatedTarget && !shouldCloseOnInteractOutside?.(e.relatedTarget)) {
          return;
        }
        onCustomValueBlurred(inputValue);
        state.close();
      },
      onKeyDown: e => {
        onKeyDown?.(e, {state});
        switch (e.key) {
          case 'Escape':
            state.close();
            onExit?.();
            return;
          case 'Enter':
            if (isOpen && state.selectionManager.focusedKey) {
              return;
            }
            state.close();
            onCustomValueCommitted(inputValue);
            return;
          default:
            return;
        }
      },
      onKeyUp,
    },
    state
  );

  const previousInputValue = usePrevious(inputValue);
  useEffect(() => {
    if (inputValue !== previousInputValue) {
      state.selectionManager.setFocusedKey(null);
    }
  }, [inputValue, previousInputValue, state.selectionManager]);

  const totalOptions = items.reduce(
    (acc, item) => acc + (itemIsSection(item) ? item.options.length : 1),
    0
  );

  const hasCustomMenu = defined(customMenu);

  const isOpen = menuIsOpen({
    state,
    hiddenOptions,
    totalOptions,
    hasCustomMenu,
    isOpen: incomingIsOpen,
  });

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [onOpenChange, isOpen]);

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
    shouldCloseOnInteractOutside: el => {
      if (popoverRef.current?.contains(el)) {
        return false;
      }

      return shouldCloseOnInteractOutside?.(el) ?? true;
    },
    onInteractOutside: () => {
      if (state.inputValue) {
        onCustomValueBlurred(inputValue);
      } else {
        onExit?.();
      }
      state.close();
    },
    shouldApplyMinWidth: false,
    preventOverflowOptions: {boundary: document.body},
    flipOptions: {
      // We don't want the menu to ever flip to the other side of the input
      fallbackPlacements: [],
    },
  });

  const descriptionPopper = usePopper(
    inputRef.current,
    descriptionRef.current,
    DESCRIPTION_POPPER_OPTIONS
  );

  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    e => {
      e.stopPropagation();
      inputProps.onClick?.(e);
      state.toggle();
      onClick?.(e);
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
      return ariaHideOutside(
        [inputRef.current, popoverRef.current, descriptionRef.current].filter(defined)
      );
    }

    return () => {};
  }, [inputRef, popoverRef, isOpen, customMenu]);

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
        disabled={disabled}
        onKeyDownCapture={e => onKeyDownCapture?.(e, {state})}
        data-test-id={dataTestId}
      />
      {description ? (
        <StyledPositionWrapper
          {...descriptionPopper.attributes.popper}
          ref={descriptionRef}
          style={descriptionPopper.styles.popper}
          visible
          role="tooltip"
        >
          <DescriptionOverlay>{description}</DescriptionOverlay>
        </StyledPositionWrapper>
      ) : null}
      <OverlayContent
        customMenu={customMenu}
        filterValue={filterValue}
        hiddenOptions={hiddenOptions}
        isOpen={isOpen}
        listBoxProps={listBoxProps}
        listBoxRef={listBoxRef}
        popoverRef={popoverRef}
        state={state}
        overlayProps={overlayProps}
      />
    </Wrapper>
  );
}

/**
 * A combobox component which is used in freeText tokens and filter values.
 */
export const SearchQueryBuilderCombobox = forwardRef(SearchQueryBuilderComboboxInner) as <
  T extends SelectOptionWithKey<string>,
>(
  props: SearchQueryBuilderComboboxProps<T> & {ref?: ForwardedRef<HTMLInputElement>}
) => ReturnType<typeof SearchQueryBuilderComboboxInner>;

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

const DescriptionOverlay = styled(Overlay)`
  min-width: 200px;
  max-width: 400px;
  padding: ${space(1)} ${space(1.5)};
  line-height: 1.2;
`;
