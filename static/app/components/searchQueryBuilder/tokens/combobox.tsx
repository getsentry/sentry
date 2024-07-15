import {
  type ForwardedRef,
  forwardRef,
  Fragment,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import {type AriaComboBoxProps, useComboBox} from '@react-aria/combobox';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import {ariaHideOutside} from '@react-aria/overlays';
import {type ComboBoxState, useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren, Key, KeyboardEvent} from '@react-types/shared';

import {Button} from 'sentry/components/button';
import {ListBox} from 'sentry/components/compactSelect/listBox';
import type {
  SelectKey,
  SelectOptionOrSectionWithKey,
  SelectOptionWithKey,
  SelectSectionWithKey,
} from 'sentry/components/compactSelect/types';
import {
  getDisabledOptions,
  getEscapedKey,
  getHiddenOptions,
} from 'sentry/components/compactSelect/utils';
import {GrowingInput} from 'sentry/components/growingInput';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay} from 'sentry/components/overlay';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import mergeRefs from 'sentry/utils/mergeRefs';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
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
   * Passes the value of the selected item.
   */
  onOptionSelected: (value: string) => void;
  token: TokenResult<Token>;
  autoFocus?: boolean;
  /**
   * Display an entirely custom menu.
   */
  customMenu?: CustomComboboxMenu;
  /**
   * Whether to display the tabbed menu.
   */
  displayTabbedMenu?: boolean;
  filterValue?: string;
  isLoading?: boolean;
  maxOptions?: number;
  onClick?: (e: React.MouseEvent) => void;
  /**
   * Called when the user explicitly closes the combobox with the escape key.
   */
  onExit?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onInputChange?: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
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

type CustomComboboxMenu = (props: {
  isOpen: boolean;
  listBoxRef: React.RefObject<HTMLUListElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
}) => React.ReactNode;

function itemIsSection(
  item: SelectOptionOrSectionWithKey<string>
): item is SelectSectionWithKey<string> {
  return 'options' in item;
}

function findItemInSections(items: SelectOptionOrSectionWithKey<string>[], key: Key) {
  for (const item of items) {
    if (itemIsSection(item)) {
      const option = item.options.find(child => child.key === key);
      if (option) {
        return option;
      }
    } else {
      if (item.key === key) {
        return item;
      }
    }
  }
  return null;
}

function mergeSets<T>(...sets: Set<T>[]) {
  const combinedSet = new Set<T>();
  for (const set of sets) {
    for (const value of set) {
      combinedSet.add(value);
    }
  }
  return combinedSet;
}

function menuIsOpen({
  state,
  hiddenOptions,
  totalOptions,
  displayTabbedMenu,
  isLoading,
  hasCustomMenu,
}: {
  hiddenOptions: Set<SelectKey>;
  state: ComboBoxState<any>;
  totalOptions: number;
  displayTabbedMenu?: boolean;
  hasCustomMenu?: boolean;
  isLoading?: boolean;
}) {
  if (displayTabbedMenu || isLoading || hasCustomMenu) {
    return state.isOpen;
  }

  // When the tabbed menu is not being displayed and we aren't loading anything,
  // only show when there is something to select from.
  return state.isOpen && totalOptions > hiddenOptions.size;
}

function useHiddenItems<T extends SelectOptionOrSectionWithKey<string>>({
  items,
  filterValue,
  maxOptions,
  displayTabbedMenu,
  selectedSection,
  shouldFilterResults,
}: {
  filterValue: string;
  items: T[];
  selectedSection: Key | null;
  displayTabbedMenu?: boolean;
  maxOptions?: number;
  shouldFilterResults?: boolean;
}) {
  const hiddenOptions: Set<SelectKey> = useMemo(() => {
    if (displayTabbedMenu) {
      if (selectedSection === null) {
        const sets = items.map(section =>
          itemIsSection(section)
            ? getHiddenOptions(section.options, filterValue, maxOptions)
            : new Set<string>()
        );
        return mergeSets(...sets);
      }
      const hiddenSections = items.filter(item => item.key !== selectedSection);
      const shownSection = items.filter(item => item.key === selectedSection);
      const hiddenFromOtherSections = getHiddenOptions(hiddenSections, '', 0);
      const hiddenFromShownSection = getHiddenOptions(shownSection, '', maxOptions);
      return mergeSets(hiddenFromOtherSections, hiddenFromShownSection);
    }

    return getHiddenOptions(items, shouldFilterResults ? filterValue : '', maxOptions);
  }, [
    displayTabbedMenu,
    items,
    shouldFilterResults,
    filterValue,
    maxOptions,
    selectedSection,
  ]);

  const disabledKeys: string[] = useMemo(
    () => [...getDisabledOptions(items), ...hiddenOptions].map(getEscapedKey),
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
function useUpdateOverlayPositionOnMenuContentChange({
  inputValue,
  isLoading,
  isOpen,
  updateOverlayPosition,
  hasCustomMenu,
}: {
  inputValue: string;
  isOpen: boolean;
  updateOverlayPosition: (() => void) | null;
  hasCustomMenu?: boolean;
  isLoading?: boolean;
}) {
  const previousValues = usePrevious({isLoading, isOpen, inputValue, hasCustomMenu});

  useLayoutEffect(() => {
    if (
      (isOpen && previousValues?.inputValue !== inputValue) ||
      previousValues?.isLoading !== isLoading ||
      hasCustomMenu !== previousValues?.hasCustomMenu
    ) {
      updateOverlayPosition?.();
    }
  }, [
    inputValue,
    isLoading,
    isOpen,
    previousValues,
    updateOverlayPosition,
    hasCustomMenu,
  ]);
}

function ListBoxSectionButton({
  onClick,
  selected,
  children,
}: {
  children: ReactNode;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <SectionButton
      size="zero"
      borderless
      aria-selected={selected}
      onClick={onClick}
      tabIndex={-1}
    >
      {children}
    </SectionButton>
  );
}

function FeedbackFooter() {
  const {searchSource} = useSearchQueryBuilder();
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <SectionedOverlayFooter>
      <Button
        size="xs"
        icon={<IconMegaphone />}
        onClick={() =>
          openForm({
            messagePlaceholder: t('How can we make search better for you?'),
            tags: {
              feedback_source: 'search_query_builder',
              search_source: searchSource,
            },
          })
        }
      >
        {t('Give Feedback')}
      </Button>
    </SectionedOverlayFooter>
  );
}

function SectionedListBox<T extends SelectOptionOrSectionWithKey<string>>({
  popoverRef,
  listBoxRef,
  listBoxProps,
  state,
  hiddenOptions,
  isOpen,
  selectedSection,
  setSelectedSection,
}: {
  hiddenOptions: Set<SelectKey>;
  isOpen: boolean;
  listBoxProps: AriaListBoxOptions<T>;
  listBoxRef: React.RefObject<HTMLUListElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
  selectedSection: Key | null;
  setSelectedSection: (section: Key | null) => void;
  state: ComboBoxState<T>;
}) {
  const sections = useMemo(
    () => [...state.collection].filter(node => node.type === 'section'),
    [state.collection]
  );

  const totalItems = state.collection.size;
  const totalItemsInSection = selectedSection
    ? [...(state.collection.getChildren?.(selectedSection) ?? [])].length
    : totalItems;
  const expectedHiddenOptions = totalItems - totalItemsInSection;
  const sectionHasHiddenOptions = hiddenOptions.size > expectedHiddenOptions;

  return (
    <SectionedOverlay ref={popoverRef}>
      {isOpen ? (
        <Fragment>
          <SectionedListBoxTabPane>
            <ListBoxSectionButton
              selected={selectedSection === null}
              onClick={() => {
                setSelectedSection(null);
                state.selectionManager.setFocusedKey(null);
              }}
            >
              {t('All')}
            </ListBoxSectionButton>
            {sections.map(node => (
              <ListBoxSectionButton
                key={node.key}
                selected={selectedSection === node.key}
                onClick={() => {
                  setSelectedSection(node.key);
                  state.selectionManager.setFocusedKey(null);
                }}
              >
                {node.props.title}
              </ListBoxSectionButton>
            ))}
          </SectionedListBoxTabPane>
          <SectionedListBoxPane>
            <ListBox
              {...listBoxProps}
              ref={listBoxRef}
              listState={state}
              hasSearch={!sectionHasHiddenOptions}
              hiddenOptions={hiddenOptions}
              keyDownHandler={() => true}
              overlayIsOpen={isOpen}
              showSectionHeaders={!selectedSection}
              size="sm"
            />
          </SectionedListBoxPane>
          <FeedbackFooter />
        </Fragment>
      ) : null}
    </SectionedOverlay>
  );
}

function OverlayContent({
  customMenu,
  displayTabbedMenu,
  filterValue,
  hiddenOptions,
  isLoading,
  isOpen,
  listBoxProps,
  listBoxRef,
  popoverRef,
  selectedSection,
  setSelectedSection,
  state,
  totalOptions,
}: {
  filterValue: string;
  hiddenOptions: Set<SelectKey>;
  isOpen: boolean;
  listBoxProps: AriaListBoxOptions<any>;
  listBoxRef: React.RefObject<HTMLUListElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
  selectedSection: Key | null;
  setSelectedSection: (section: Key | null) => void;
  state: ComboBoxState<any>;
  totalOptions: number;
  customMenu?: CustomComboboxMenu;
  displayTabbedMenu?: boolean;
  isLoading?: boolean;
}) {
  if (customMenu) {
    return customMenu({popoverRef, listBoxRef, isOpen});
  }

  if (displayTabbedMenu) {
    return (
      <SectionedListBox
        popoverRef={popoverRef}
        listBoxProps={listBoxProps}
        listBoxRef={listBoxRef}
        state={state}
        isOpen={isOpen}
        hiddenOptions={hiddenOptions}
        selectedSection={selectedSection}
        setSelectedSection={setSelectedSection}
      />
    );
  }

  return (
    <ListBoxOverlay ref={popoverRef}>
      {isLoading && hiddenOptions.size >= totalOptions ? (
        <LoadingWrapper>
          <LoadingIndicator mini />
        </LoadingWrapper>
      ) : (
        <ListBox
          {...listBoxProps}
          ref={listBoxRef}
          listState={state}
          hasSearch={!!filterValue}
          hiddenOptions={hiddenOptions}
          keyDownHandler={() => true}
          overlayIsOpen={isOpen}
          showSectionHeaders={!filterValue}
          size="sm"
        />
      )}
    </ListBoxOverlay>
  );
}

function SearchQueryBuilderComboboxInner<T extends SelectOptionOrSectionWithKey<string>>(
  {
    children,
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
    onKeyUp,
    onInputChange,
    autoFocus,
    openOnFocus,
    onFocus,
    tabIndex = -1,
    maxOptions,
    shouldFilterResults = true,
    shouldCloseOnInteractOutside,
    onPaste,
    displayTabbedMenu,
    isLoading,
    onClick,
    customMenu,
  }: SearchQueryBuilderComboboxProps<T>,
  ref: ForwardedRef<HTMLInputElement>
) {
  const listBoxRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [selectedSection, setSelectedSection] = useState<Key | null>(null);

  const {hiddenOptions, disabledKeys} = useHiddenItems({
    items,
    filterValue,
    maxOptions,
    displayTabbedMenu,
    selectedSection,
    shouldFilterResults,
  });

  const onSelectionChange = useCallback(
    (key: Key) => {
      const selectedOption = findItemInSections(items, key);
      if (selectedOption && 'textValue' in selectedOption && selectedOption.textValue) {
        onOptionSelected(selectedOption.textValue);
      } else if (key) {
        onOptionSelected(key.toString());
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
  };

  const state = useComboBoxState<T>({
    children,
    allowsEmptyCollection: true,
    // We handle closing on blur ourselves to prevent the combobox from closing
    // when the user clicks inside the tabbed menu
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
        onKeyDown?.(e);
        switch (e.key) {
          case 'Escape':
            state.close();
            onExit?.();
            return;
          case 'Enter':
            if (state.selectionManager.focusedKey) {
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
    displayTabbedMenu,
    isLoading,
    hasCustomMenu,
  });

  const {
    overlayProps,
    triggerProps,
    update: updateOverlayPosition,
  } = useOverlay({
    type: 'listbox',
    isOpen,
    position: 'bottom-start',
    offset: [-12, 8],
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
    preventOverflowOptions: {boundary: document.body, altAxis: true},
  });

  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    e => {
      e.stopPropagation();
      inputProps.onClick?.(e);
      state.toggle();
      onClick?.(e);
    },
    [inputProps, state, onClick]
  );

  useUpdateOverlayPositionOnMenuContentChange({
    inputValue,
    isLoading,
    isOpen,
    updateOverlayPosition,
    hasCustomMenu,
  });

  // useCombobox will hide outside elements with aria-hidden="true" when it is open [1].
  // Because we switch elements when the custom or tabbed menu is displayed, we need to
  // manually call this function an extra time to ensure the correct elements are hidden.
  //
  // [1]: https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/combobox/src/useComboBox.ts#L337C3-L341C44
  useEffect(() => {
    if (isOpen && inputRef.current && popoverRef.current) {
      return ariaHideOutside([inputRef.current, popoverRef.current]);
    }

    return () => {};
  }, [inputRef, popoverRef, isOpen, customMenu, displayTabbedMenu]);

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
      />
      <StyledPositionWrapper {...overlayProps} visible={isOpen}>
        <OverlayContent
          customMenu={customMenu}
          displayTabbedMenu={displayTabbedMenu}
          filterValue={filterValue}
          hiddenOptions={hiddenOptions}
          isLoading={isLoading}
          isOpen={isOpen}
          listBoxProps={listBoxProps}
          listBoxRef={listBoxRef}
          popoverRef={popoverRef}
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
          state={state}
          totalOptions={totalOptions}
        />
      </StyledPositionWrapper>
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

const SectionedOverlay = styled(Overlay)`
  overflow: hidden;
  display: grid;
  grid-template-columns: 120px 240px;
  grid-template-rows: 1fr auto;
  grid-template-areas:
    'left right'
    'footer footer';
  height: 400px;
  width: 360px;
`;

const SectionedOverlayFooter = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  grid-area: footer;
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const SectionedListBoxPane = styled('div')`
  overflow-y: auto;
`;

const SectionedListBoxTabPane = styled(SectionedListBoxPane)`
  padding: ${space(1)};
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  border-right: 1px solid ${p => p.theme.innerBorder};
`;

const SectionButton = styled(Button)`
  display: block;
  height: 32px;
  width: 100%;
  text-align: left;
  font-weight: ${p => p.theme.fontWeightNormal};
  padding: 0 ${space(1)};

  span {
    justify-content: flex-start;
  }

  &[aria-selected='true'] {
    background-color: ${p => p.theme.purple100};
    color: ${p => p.theme.purple300};
    font-weight: ${p => p.theme.fontWeightBold};
  }
`;

const LoadingWrapper = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 140px;
`;
