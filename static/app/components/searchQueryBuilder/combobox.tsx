import {
  type ForwardedRef,
  forwardRef,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import {type AriaComboBoxProps, useComboBox} from '@react-aria/combobox';
import type {AriaListBoxOptions} from '@react-aria/listbox';
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
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
   * Passes the value of the selected item.
   */
  onOptionSelected: (value: string) => void;
  token: TokenResult<Token>;
  autoFocus?: boolean;
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
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  openOnFocus?: boolean;
  placeholder?: string;
  /**
   * Function to determine whether the menu should close when interacting with
   * other elements.
   */
  shouldCloseOnInteractOutside?: (interactedElement: Element) => boolean;
  tabIndex?: number;
};

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
}: {
  hiddenOptions: Set<SelectKey>;
  state: ComboBoxState<any>;
  totalOptions: number;
  displayTabbedMenu?: boolean;
  isLoading?: boolean;
}) {
  if (displayTabbedMenu || isLoading) {
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
}: {
  filterValue: string;
  items: T[];
  selectedSection: Key | null;
  displayTabbedMenu?: boolean;
  maxOptions?: number;
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

    return getHiddenOptions(items, filterValue, maxOptions);
  }, [displayTabbedMenu, items, filterValue, maxOptions, selectedSection]);

  const disabledKeys: string[] = useMemo(
    () => [...getDisabledOptions(items), ...hiddenOptions].map(getEscapedKey),
    [hiddenOptions, items]
  );

  return {
    hiddenOptions,
    disabledKeys,
  };
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
          size="sm"
        />
      </SectionedListBoxPane>
    </SectionedOverlay>
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
    onInputChange,
    autoFocus,
    openOnFocus,
    onFocus,
    tabIndex = -1,
    maxOptions,
    shouldCloseOnInteractOutside,
    onPaste,
    displayTabbedMenu,
    isLoading,
    onClick,
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
    },
    state
  );

  const totalOptions = items.reduce(
    (acc, item) => acc + (itemIsSection(item) ? item.options.length : 1),
    0
  );
  const isOpen = menuIsOpen({
    state,
    hiddenOptions,
    totalOptions,
    displayTabbedMenu,
    isLoading,
  });

  const {
    overlayProps,
    triggerProps,
    update: updateOverlayPosition,
  } = useOverlay({
    type: 'listbox',
    isOpen,
    position: 'bottom-start',
    offset: [0, 8],
    isKeyboardDismissDisabled: true,
    shouldCloseOnBlur: true,
    shouldCloseOnInteractOutside,
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

  const previousValues = usePrevious({isLoading, isOpen, inputValue});

  useLayoutEffect(() => {
    if (
      (isOpen && previousValues?.inputValue !== inputValue) ||
      previousValues?.isLoading !== isLoading
    ) {
      updateOverlayPosition?.();
    }
  }, [inputValue, isLoading, isOpen, previousValues, updateOverlayPosition]);

  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    e => {
      e.stopPropagation();
      inputProps.onClick?.(e);
      state.toggle();
      onClick?.(e);
    },
    [inputProps, state, onClick]
  );

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
        {displayTabbedMenu ? (
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
        ) : (
          <StyledOverlay ref={popoverRef}>
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
                size="sm"
              />
            )}
          </StyledOverlay>
        )}
      </StyledPositionWrapper>
    </Wrapper>
  );
}

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

const StyledOverlay = styled(Overlay)`
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
  height: 400px;
  width: 360px;
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
