import {
  type ForwardedRef,
  forwardRef,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useComboBox} from '@react-aria/combobox';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import {type ComboBoxState, useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren, Key} from '@react-types/shared';

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
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';
import useOverlay from 'sentry/utils/useOverlay';

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
  maxOptions?: number;
  /**
   * Called when the user explicitly closes the combobox with the escape key.
   */
  onExit?: () => void;
  onInputChange?: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
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
  items,
  displayTabbedMenu,
}: {
  hiddenOptions: Set<SelectKey>;
  items: SelectOptionOrSectionWithKey<string>[];
  state: ComboBoxState<any>;
  displayTabbedMenu?: boolean;
}) {
  if (displayTabbedMenu) {
    return state.isOpen;
  }

  // When the tabbed menu is not being displayed, we only want to show the menu
  // when there are options to select from
  const totalOptions = items.reduce(
    (acc, item) => acc + (itemIsSection(item) ? item.options.length : 1),
    0
  );

  return totalOptions > hiddenOptions.size;
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
          size="md"
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
    tabIndex = -1,
    maxOptions,
    shouldCloseOnInteractOutside,
    onPaste,
    displayTabbedMenu,
  }: SearchQueryBuilderComboboxProps<T>,
  ref: ForwardedRef<HTMLInputElement>
) {
  const theme = useTheme();
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

  const state = useComboBoxState<T>({
    children,
    items,
    autoFocus,
    inputValue: filterValue,
    onSelectionChange,
    disabledKeys,
  });

  const {inputProps, listBoxProps} = useComboBox<T>(
    {
      'aria-label': inputLabel,
      listBoxRef,
      inputRef,
      popoverRef,
      items,
      inputValue: filterValue,
      onSelectionChange,
      autoFocus,
      onFocus: () => {
        if (openOnFocus) {
          state.open();
        }
      },
      onBlur: () => {
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

  const isOpen = menuIsOpen({state, hiddenOptions, items, displayTabbedMenu});

  const {overlayProps, triggerProps} = useOverlay({
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
  });

  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    e => {
      e.stopPropagation();
      inputProps.onClick?.(e);
      state.toggle();
    },
    [inputProps, state]
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
      <StyledPositionWrapper
        {...overlayProps}
        zIndex={theme.zIndex?.tooltip}
        visible={isOpen}
      >
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

const StyledPositionWrapper = styled(PositionWrapper, {
  shouldForwardProp: prop => isPropValid(prop),
})<{visible?: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const StyledOverlay = styled(Overlay)`
  max-height: 400px;
  min-width: 200px;
  width: 300px;
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
