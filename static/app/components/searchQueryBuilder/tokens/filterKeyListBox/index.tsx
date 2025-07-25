import {Fragment, type ReactNode, useEffect, useMemo, useRef} from 'react';
import {createPortal} from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useOption} from '@react-aria/listbox';
import type {ComboBoxState} from '@react-stately/combobox';
import type {Key} from '@react-types/shared';

import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import {ListBox} from 'sentry/components/core/compactSelect/listBox';
import type {
  SelectKey,
  SelectOptionOrSectionWithKey,
} from 'sentry/components/core/compactSelect/types';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Overlay} from 'sentry/components/overlay';
import {
  ASK_SEER_CONSENT_ITEM_KEY,
  ASK_SEER_ITEM_KEY,
  AskSeer,
} from 'sentry/components/searchQueryBuilder/askSeer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {CustomComboboxMenuProps} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {KeyDescription} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/keyDescription';
import type {Section} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {
  createRecentFilterOptionKey,
  RECENT_SEARCH_CATEGORY_VALUE,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import {getKeyLabel, getKeyName} from 'sentry/components/searchSyntax/utils';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import usePrevious from 'sentry/utils/usePrevious';

interface FilterKeyListBoxProps<T> extends CustomComboboxMenuProps<T> {
  recentFilters: Array<TokenResult<Token.FILTER>>;
  sections: Section[];
  selectedSection: string;
  setSelectedSection: (section: string) => void;
}

interface FilterKeyMenuContentProps<T>
  extends Pick<
    FilterKeyListBoxProps<T>,
    | 'hiddenOptions'
    | 'listBoxProps'
    | 'listBoxRef'
    | 'recentFilters'
    | 'state'
    | 'selectedSection'
    | 'setSelectedSection'
    | 'sections'
  > {
  fullWidth: boolean;
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
              search_source: searchSource,
              ['feedback.source']: 'search_query_builder',
              ['feedback.owner']: 'issues',
            },
          })
        }
      >
        {t('Give Feedback')}
      </Button>
    </SectionedOverlayFooter>
  );
}

function RecentSearchFilterOption<T>({
  state,
  filter,
}: {
  filter: TokenResult<Token.FILTER>;
  state: ComboBoxState<T>;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const key = getKeyName(filter.key);
  const {optionProps, labelProps, isFocused, isPressed} = useOption(
    {
      key: createRecentFilterOptionKey(key),
      'aria-label': key,
      shouldFocusOnHover: true,
      shouldSelectOnPressUp: true,
    },
    state,
    ref
  );

  return (
    <RecentFilterPill key={key} data-test-id="recent-filter-key" {...optionProps}>
      <InteractionStateLayer isHovered={isFocused} isPressed={isPressed} />
      <RecentFilterPillLabel {...labelProps}>
        {getKeyLabel(filter.key)}
      </RecentFilterPillLabel>
    </RecentFilterPill>
  );
}

function useHighlightFirstOptionOnSectionChange({
  state,
  selectedSection,
  sections,
  hiddenOptions,
  isOpen,
}: {
  hiddenOptions: Set<SelectKey>;
  isOpen: boolean;
  sections: Section[];
  selectedSection: Key | null;
  state: ComboBoxState<SelectOptionOrSectionWithKey<string>>;
}) {
  const displayedListItems = useMemo(() => {
    if (selectedSection === RECENT_SEARCH_CATEGORY_VALUE) {
      return [...state.collection].filter(item => !hiddenOptions.has(item.key));
    }
    const options = state.collection.getChildren?.(selectedSection ?? sections[0]!.value);
    return [...(options ?? [])].filter(option => !hiddenOptions.has(option.key));
  }, [state.collection, selectedSection, sections, hiddenOptions]);

  const previousSection = usePrevious(selectedSection);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (selectedSection === previousSection) {
      return;
    }
    const firstItem = displayedListItems[0];
    if (firstItem) {
      state.selectionManager.setFocusedKey(firstItem.key);
    }
  }, [
    displayedListItems,
    isOpen,
    previousSection,
    selectedSection,
    state.selectionManager,
  ]);
}

// If the selected section no longer exists, switch to the first valid section
function useSwitchToValidSection({
  sections,
  selectedSection,
  setSelectedSection,
}: {
  sections: Section[];
  selectedSection: Key | null;
  setSelectedSection: (section: string) => void;
}) {
  useEffect(() => {
    if (!selectedSection || !sections.length) {
      return;
    }

    const section = sections.find(s => s.value === selectedSection);
    if (!section) {
      setSelectedSection(sections[0]!.value);
    }
  }, [sections, selectedSection, setSelectedSection]);
}

function FilterKeyMenuContent<T extends SelectOptionOrSectionWithKey<string>>({
  recentFilters,
  selectedSection,
  setSelectedSection,
  state,
  listBoxProps,
  hiddenOptions,
  listBoxRef,
  fullWidth,
  sections,
}: FilterKeyMenuContentProps<T>) {
  const {filterKeys, enableAISearch} = useSearchQueryBuilder();
  const focusedItem = state.selectionManager.focusedKey
    ? (state.collection.getItem(state.selectionManager.focusedKey)?.props?.value as
        | string
        | undefined)
    : undefined;
  const focusedKey = focusedItem ? filterKeys[focusedItem] : null;
  const showRecentFilters = recentFilters.length > 0;
  const showDetailsPane = fullWidth && selectedSection !== RECENT_SEARCH_CATEGORY_VALUE;

  return (
    <Fragment>
      {enableAISearch ? (
        <Feature features="organizations:gen-ai-explore-traces">
          <AskSeer state={state} />
        </Feature>
      ) : null}
      {showRecentFilters ? (
        <RecentFiltersPane>
          {recentFilters.map(filter => (
            <RecentSearchFilterOption
              key={getKeyName(filter.key)}
              filter={filter}
              state={state}
            />
          ))}
        </RecentFiltersPane>
      ) : null}
      <SectionedListBoxTabPane>
        {sections.map(section => (
          <ListBoxSectionButton
            key={section.value}
            selected={selectedSection === section.value}
            onClick={() => {
              setSelectedSection(section.value);
            }}
          >
            {section.label}
          </ListBoxSectionButton>
        ))}
      </SectionedListBoxTabPane>
      <SectionedListBoxPane>
        <ListBox
          {...listBoxProps}
          ref={listBoxRef}
          listState={state}
          hasSearch={selectedSection === RECENT_SEARCH_CATEGORY_VALUE}
          hiddenOptions={hiddenOptions}
          keyDownHandler={() => true}
          overlayIsOpen
          showSectionHeaders={!selectedSection}
          size="sm"
          showDetails={!fullWidth}
        />
      </SectionedListBoxPane>
      {showDetailsPane ? (
        <DetailsPane>
          {focusedKey ? (
            <KeyDescription size="md" tag={focusedKey} />
          ) : (
            <EmptyState>
              <div>
                <p>{t('No filter selected.')}</p>
                <p>
                  {t(
                    'Hover over a filter from the list on the left to see more details.'
                  )}
                </p>
              </div>
            </EmptyState>
          )}
        </DetailsPane>
      ) : null}
      <FeedbackFooter />
    </Fragment>
  );
}

export function FilterKeyListBox<T extends SelectOptionOrSectionWithKey<string>>({
  hiddenOptions,
  isOpen,
  listBoxProps,
  listBoxRef,
  popoverRef,
  recentFilters,
  state,
  sections,
  selectedSection,
  setSelectedSection,
  overlayProps,
}: FilterKeyListBoxProps<T>) {
  const {filterKeyMenuWidth, wrapperRef, query, portalTarget, enableAISearch} =
    useSearchQueryBuilder();

  const hiddenOptionsWithRecentsAndAskSeerAdded = useMemo<Set<SelectKey>>(() => {
    const baseHidden = [
      ...hiddenOptions,
      ...recentFilters.map(filter => createRecentFilterOptionKey(getKeyName(filter.key))),
    ];

    if (enableAISearch) {
      baseHidden.push(ASK_SEER_ITEM_KEY);
      baseHidden.push(ASK_SEER_CONSENT_ITEM_KEY);
    }

    return new Set(baseHidden);
  }, [enableAISearch, hiddenOptions, recentFilters]);

  useHighlightFirstOptionOnSectionChange({
    state,
    selectedSection,
    hiddenOptions: hiddenOptionsWithRecentsAndAskSeerAdded,
    sections,
    isOpen,
  });

  useSwitchToValidSection({sections, selectedSection, setSelectedSection});

  const fullWidth = !query;
  const showDetailsPane = fullWidth && selectedSection !== RECENT_SEARCH_CATEGORY_VALUE;

  // Remove bottom border radius of top-level component while the full-width menu is open
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !fullWidth || !isOpen) {
      return () => {};
    }

    wrapper.style.borderBottomLeftRadius = '0';
    wrapper.style.borderBottomRightRadius = '0';

    return () => {
      wrapper.style.borderBottomLeftRadius = '';
      wrapper.style.borderBottomRightRadius = '';
    };
  }, [fullWidth, isOpen, wrapperRef]);

  if (fullWidth) {
    if (!wrapperRef.current) {
      return null;
    }
    return createPortal(
      <StyledPositionWrapper
        {...overlayProps}
        visible={isOpen}
        style={{position: 'absolute', width: '100%', left: 0, top: 38, right: 0}}
      >
        <SectionedOverlay
          ref={popoverRef}
          fullWidth
          showDetailsPane={showDetailsPane}
          hasAiFeatures={enableAISearch}
        >
          {isOpen ? (
            <FilterKeyMenuContent
              fullWidth={fullWidth}
              hiddenOptions={hiddenOptionsWithRecentsAndAskSeerAdded}
              listBoxProps={listBoxProps}
              listBoxRef={listBoxRef}
              recentFilters={recentFilters}
              selectedSection={selectedSection}
              setSelectedSection={setSelectedSection}
              state={state}
              sections={sections}
            />
          ) : null}
        </SectionedOverlay>
      </StyledPositionWrapper>,
      wrapperRef.current
    );
  }

  const filterKeyListBoxContent = (
    <StyledPositionWrapper {...overlayProps} visible={isOpen}>
      <SectionedOverlay
        ref={popoverRef}
        width={filterKeyMenuWidth}
        hasAiFeatures={enableAISearch}
      >
        {isOpen ? (
          <FilterKeyMenuContent
            fullWidth={fullWidth}
            hiddenOptions={hiddenOptionsWithRecentsAndAskSeerAdded}
            listBoxProps={listBoxProps}
            listBoxRef={listBoxRef}
            recentFilters={recentFilters}
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
            state={state}
            sections={sections}
          />
        ) : null}
      </SectionedOverlay>
    </StyledPositionWrapper>
  );

  if (portalTarget) {
    return createPortal(filterKeyListBoxContent, portalTarget);
  }

  return filterKeyListBoxContent;
}

const SectionedOverlay = styled(Overlay, {
  shouldForwardProp: prop =>
    !['fullWidth', 'showDetailsPane', 'width', 'hasAiFeatures'].includes(prop),
})<{
  fullWidth?: boolean;
  hasAiFeatures?: boolean;
  showDetailsPane?: boolean;
  width?: number;
}>`
  display: grid;
  ${p =>
    p.hasAiFeatures
      ? css`
          grid-template-rows: auto auto auto 1fr auto;
          grid-template-columns: ${p.fullWidth ? '50% 50%' : '1fr'};
          grid-template-areas:
            'seer seer'
            'recentFilters recentFilters'
            'tabs tabs'
            'list list'
            'footer footer';
          ${p.fullWidth &&
          css`
            grid-template-areas:
              'seer seer'
              'recentFilters recentFilters'
              'tabs tabs'
              ${p.showDetailsPane ? "'list details'" : "'list list'"}
              'footer footer';
          `}
        `
      : css`
          grid-template-rows: auto auto 1fr auto;
          grid-template-columns: ${p.fullWidth ? '50% 50%' : '1fr'};
          grid-template-areas:
            'recentFilters recentFilters'
            'tabs tabs'
            'list list'
            'footer footer';
          ${p.fullWidth &&
          css`
            grid-template-areas:
              'recentFilters recentFilters'
              'tabs tabs'
              ${p.showDetailsPane ? "'list details'" : "'list list'"}
              'footer footer';
          `}
        `}
  overflow: hidden;
  height: 400px;
  width: ${p => (p.fullWidth ? '100%' : `${p.width}px`)};
  ${p =>
    p.fullWidth && `border-radius: 0 0 ${p.theme.borderRadius} ${p.theme.borderRadius}`};
`;

const SectionedOverlayFooter = styled('div')`
  grid-area: footer;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const RecentFiltersPane = styled('ul')`
  grid-area: recentFilters;
  display: flex;
  flex-wrap: wrap;
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(1)} 10px;
  gap: ${space(0.25)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  margin: 0;
`;

const SectionedListBoxPane = styled('div')`
  grid-area: list;
  overflow-y: auto;
`;

const DetailsPane = styled('div')`
  grid-area: details;
  overflow-y: auto;
  border-left: 1px solid ${p => p.theme.innerBorder};
`;

const SectionedListBoxTabPane = styled('div')`
  grid-area: tabs;
  padding: ${space(0.5)};
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.25)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const RecentFilterPill = styled('li')`
  position: relative;
  display: flex;
  align-items: center;
  height: 22px;
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  padding: 0 ${space(1.5)} 0 ${space(0.75)};
  background-color: ${p => p.theme.background};
  box-shadow: inset 0 0 0 1px ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};
  cursor: pointer;

  /* Fade out on right side to represent that this is a filter key only */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      to left,
      ${p => p.theme.backgroundSecondary} 0 2px,
      transparent ${space(2)} 100%
    );
  }
`;

const RecentFilterPillLabel = styled('div')`
  ${p => p.theme.overflowEllipsis};
  max-width: 200px;
`;

const SectionButton = styled(Button)`
  height: 20px;
  text-align: left;
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  padding: 0 ${space(1.5)};
  color: ${p => p.theme.subText};
  border: 0;

  &[aria-selected='true'] {
    background-color: ${p => p.theme.purple100};
    box-shadow: inset 0 0 0 1px ${p => p.theme.purple100};
    color: ${p => p.theme.purple300};
    font-weight: ${p => p.theme.fontWeight.bold};
  }
`;

const StyledPositionWrapper = styled('div')<{visible?: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
  z-index: ${p => p.theme.zIndex.tooltip};
`;

const EmptyState = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${space(4)};
  text-align: center;
  color: ${p => p.theme.subText};

  div {
    max-width: 280px;
  }
`;
