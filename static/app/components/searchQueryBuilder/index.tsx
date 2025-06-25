import {useContext, useLayoutEffect} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  SearchQueryBuilderContext,
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {useOnChange} from 'sentry/components/searchQueryBuilder/hooks/useOnChange';
import {PlainTextQueryInput} from 'sentry/components/searchQueryBuilder/plainTextQueryInput';
import {TokenizedQueryGrid} from 'sentry/components/searchQueryBuilder/tokenizedQueryGrid';
import {
  type CallbackSearchState,
  type FieldDefinitionGetter,
  type FilterKeySection,
  QueryInterfaceType,
} from 'sentry/components/searchQueryBuilder/types';
import {queryIsValid} from 'sentry/components/searchQueryBuilder/utils';
import type {SearchConfig} from 'sentry/components/searchSyntax/parser';
import {IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SavedSearchType, Tag, TagCollection} from 'sentry/types/group';
import PanelProvider from 'sentry/utils/panelProvider';
import {useDimensions} from 'sentry/utils/useDimensions';

export interface SearchQueryBuilderProps {
  /**
   * A complete mapping of all possible filter keys.
   * Filter keys not included will not show up when typing and may be shown as invalid.
   * Should be a stable reference.
   */
  filterKeys: TagCollection;
  getTagValues: (key: Tag, query: string) => Promise<string[]>;
  initialQuery: string;
  /**
   * Indicates the usage of the search bar for analytics
   */
  searchSource: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  /**
   * When true, free text will be marked as invalid.
   */
  disallowFreeText?: boolean;
  /**
   * When true, parens and logical operators (AND, OR) will be marked as invalid.
   */
  disallowLogicalOperators?: boolean;
  /**
   * When true, unsupported filter keys will be highlighted as invalid.
   */
  disallowUnsupportedFilters?: boolean;
  /**
   * When true, the wildcard (*) in filter values or free text will be marked as invalid.
   */
  disallowWildcard?: boolean;
  /**
   * The lookup strategy for field definitions.
   * Each SearchQueryBuilder instance can support a different list of fields and
   * tags, their definitions may not overlap.
   */
  fieldDefinitionGetter?: FieldDefinitionGetter;
  /**
   * The width of the filter key menu.
   * Defaults to 360px. May be increased if there are a large number of categories
   * or long filter key names.
   */
  filterKeyMenuWidth?: number;
  /**
   * When provided, displays a tabbed interface for discovering filter keys.
   * Sections and filter keys are displayed in the order they are provided.
   */
  filterKeySections?: FilterKeySection[];
  /**
   * A function that returns a warning message for a given filter key
   * will only render a warning if the value is truthy
   */
  getFilterTokenWarning?: (key: string) => React.ReactNode;
  /**
   * This is used when a user types in a search key and submits the token.
   * The submission happens when the user types a colon or presses enter.
   * When this happens, this function is used to map the user input to a
   * known column.
   */
  getSuggestedFilterKey?: (key: string) => string | null;
  /**
   * Allows for customization of the invalid token messages.
   */
  invalidMessages?: SearchConfig['invalidMessages'];
  label?: string;
  onBlur?: (query: string, state: CallbackSearchState) => void;
  /**
   * Called when the query value changes
   */
  onChange?: (query: string, state: CallbackSearchState) => void;
  /**
   * Called when the user presses enter
   */
  onSearch?: (query: string, state: CallbackSearchState) => void;
  placeholder?: string;
  /**
   * If provided, will render the combobox popovers into the given element.
   * This is useful when the search query builder is rendered as a child of an
   * element that has CSS styling that prevents popovers from overflowing, e.g.
   * a scrollable container.
   */
  portalTarget?: HTMLElement | null;
  queryInterface?: QueryInterfaceType;
  /**
   * If provided, saves and displays recent searches of the given type.
   */
  recentSearches?: SavedSearchType;
  /**
   * When true, will trigger the `onSearch` callback when the query changes.
   */
  searchOnChange?: boolean;
  /**
   * When true, will display a visual indicator when there are unsaved changes.
   * This search is considered unsubmitted when query !== initialQuery.
   */
  showUnsubmittedIndicator?: boolean;
  /**
   * Render custom content in the trailing section of the search bar, located
   * to the left of the clear button.
   */
  trailingItems?: React.ReactNode;
}

function SearchIndicator({
  initialQuery,
  showUnsubmittedIndicator,
}: {
  initialQuery?: string;
  showUnsubmittedIndicator?: boolean;
}) {
  const {query} = useSearchQueryBuilder();

  const unSubmittedChanges = query !== initialQuery;
  const showIndicator = showUnsubmittedIndicator && unSubmittedChanges;

  return (
    <PositionedSearchIconContainer>
      <Tooltip
        title={t('The current search query is not active. Press Enter to submit.')}
        disabled={!showIndicator}
      >
        <SearchIcon size="sm" />
        {showIndicator ? <UnSubmittedDot /> : null}
      </Tooltip>
    </PositionedSearchIconContainer>
  );
}

function ActionButtons({
  ref,
  trailingItems = null,
}: {
  ref?: React.Ref<HTMLDivElement>;
  trailingItems?: React.ReactNode;
}) {
  const {dispatch, handleSearch, disabled, query} = useSearchQueryBuilder();

  if (disabled) {
    return null;
  }

  return (
    <ButtonsWrapper ref={ref}>
      {trailingItems}
      {query === '' ? null : (
        <ActionButton
          aria-label={t('Clear search query')}
          size="zero"
          icon={<IconClose />}
          borderless
          onClick={() => {
            dispatch({type: 'CLEAR'});
            handleSearch('');
          }}
        />
      )}
    </ButtonsWrapper>
  );
}

function SearchQueryBuilderUI({
  autoFocus,
  className,
  disabled = false,
  label,
  initialQuery,
  onBlur,
  queryInterface = QueryInterfaceType.TOKENIZED,
  showUnsubmittedIndicator,
  trailingItems,
  onChange,
  searchOnChange,
}: SearchQueryBuilderProps) {
  const {parsedQuery, query, dispatch, wrapperRef, actionBarRef, size} =
    useSearchQueryBuilder();

  useOnChange({onChange, searchOnChange});
  useLayoutEffect(() => {
    dispatch({type: 'UPDATE_QUERY', query: initialQuery});
  }, [dispatch, initialQuery]);

  const {width: actionBarWidth} = useDimensions({elementRef: actionBarRef});

  return (
    <Wrapper
      className={className}
      onBlur={() =>
        onBlur?.(query, {parsedQuery, queryIsValid: queryIsValid(parsedQuery)})
      }
      ref={wrapperRef as React.RefObject<HTMLInputElement>}
      aria-disabled={disabled}
      data-test-id="search-query-builder"
    >
      <PanelProvider>
        <SearchIndicator
          initialQuery={initialQuery}
          showUnsubmittedIndicator={showUnsubmittedIndicator && !searchOnChange}
        />
        {!parsedQuery || queryInterface === QueryInterfaceType.TEXT ? (
          <PlainTextQueryInput label={label} />
        ) : (
          <TokenizedQueryGrid
            autoFocus={autoFocus || false}
            label={label}
            actionBarWidth={actionBarWidth}
          />
        )}
        {size !== 'small' && (
          <ActionButtons ref={actionBarRef} trailingItems={trailingItems} />
        )}
      </PanelProvider>
    </Wrapper>
  );
}

export function SearchQueryBuilder({...props}: SearchQueryBuilderProps) {
  const contextValue = useContext(SearchQueryBuilderContext);

  if (contextValue) {
    return <SearchQueryBuilderUI {...props} />;
  }
  return (
    <SearchQueryBuilderProvider {...props}>
      <SearchQueryBuilderUI {...props} />
    </SearchQueryBuilderProvider>
  );
}

const Wrapper = styled(Input.withComponent('div'))`
  min-height: ${p => p.theme.form.md.minHeight};
  padding: 0;
  height: auto;
  width: 100%;
  position: relative;
  font-size: ${p => p.theme.fontSize.md};
  cursor: text;
`;

const ButtonsWrapper = styled('div')`
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ActionButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const PositionedSearchIconContainer = styled('div')`
  position: absolute;
  left: ${space(1.5)};
  top: ${p => (p.theme.isChonk ? space(0.75) : space(1))};
`;

const SearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  height: 22px;
`;

const UnSubmittedDot = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${p => p.theme.active};
  border: solid 2px ${p => p.theme.background};
`;
