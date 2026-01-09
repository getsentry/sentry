import {useContext, useLayoutEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  SearchQueryBuilderContext,
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {useOnChange} from 'sentry/components/searchQueryBuilder/hooks/useOnChange';
import {PlainTextQueryInput} from 'sentry/components/searchQueryBuilder/plainTextQueryInput';
import {TokenizedQueryGrid} from 'sentry/components/searchQueryBuilder/tokenizedQueryGrid';
import {
  QueryInterfaceType,
  type CallbackSearchState,
  type FieldDefinitionGetter,
  type FilterKeySection,
} from 'sentry/components/searchQueryBuilder/types';
import {queryIsValid} from 'sentry/components/searchQueryBuilder/utils';
import type {SearchConfig} from 'sentry/components/searchSyntax/parser';
import {IconCase, IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SavedSearchType, Tag, TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import type {FieldKind} from 'sentry/utils/fields';
import PanelProvider from 'sentry/utils/panelProvider';
import {useDimensions} from 'sentry/utils/useDimensions';

export type GetTagValues = (
  tag: Pick<Tag, 'key' | 'name'> & {kind: FieldKind | undefined},
  searchQuery: string
) => Promise<string[]>;

export interface SearchQueryBuilderProps {
  /**
   * A complete mapping of all possible filter keys.
   * Filter keys not included will not show up when typing and may be shown as invalid.
   * Should be a stable reference.
   */
  filterKeys: TagCollection;
  getTagValues: GetTagValues;
  initialQuery: string;
  /**
   * Indicates the usage of the search bar for analytics
   */
  searchSource: string;
  /**
   * The badge type to display for the AI search option.
   * Defaults to 'beta'.
   */
  aiSearchBadgeType?: 'alpha' | 'beta';
  autoFocus?: boolean;
  /**
   * Controls the state of the case sensitivity toggle.
   * - `true` = case insensitive
   * - `null` = case sensitive
   */
  caseInsensitive?: CaseInsensitive;
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
   * When true, the Ask Seer option will be displayed in the search bar.
   */
  enableAISearch?: boolean;
  /**
   * The lookup strategy for field definitions.
   * Each SearchQueryBuilder instance can support a different list of fields and
   * tags, their definitions may not overlap.
   */
  fieldDefinitionGetter?: FieldDefinitionGetter;
  /**
   * A mapping of aliases for filter keys.
   * These are used to ensure that the filter key does not show them as invalid, however
   * they will not be shown in the filter key dropdown.
   */
  filterKeyAliases?: TagCollection;
  /**
   * The width of the filter key menu.
   * Defaults to 460px. May be increased if there are a large number of categories
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
  /**
   * Allows for key suggestions to be rendered when the value matches the pattern.
   * This is useful for keys that have a specific format, such as trace IDs or IDs.
   *
   * @example
   * ```tsx
   * <SearchQueryBuilder
   *   // ...
   *   matchKeySuggestions={[{key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/}]}
   * />
   * ```
   */
  matchKeySuggestions?: Array<{key: string; valuePattern: RegExp}>;
  /**
   * If provided, filters recent searches by this query string on the backend.
   * This query will not be displayed in the UI because it is stripped from the
   * API response results before rendering.
   */
  namespace?: string;
  onBlur?: (query: string, state: CallbackSearchState) => void;
  /**
   * When passed, this will display the case sensitivity toggle, and will be called when
   * the user clicks on the case sensitivity button.
   */
  onCaseInsensitiveClick?: (value: CaseInsensitive) => void;
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
   * When set, provided keys will override default raw search capabilities, while
   * replacing it with options that include the provided keys, and the user's input
   * as value.
   *
   * e.g. if `replaceRawSearchKeys` is set to `['span.description']`, the user will be
   * able to type `randomValue` and the combobox will show `span.description:randomValue`
   * as an option, and so on with any other provided keys.
   */
  replaceRawSearchKeys?: string[];
  /**
   * Render custom content in the trailing section of the search bar, located
   * to the left of the clear button.
   */
  trailingItems?: React.ReactNode;
}

function ActionButtons({
  ref,
  trailingItems = null,
}: {
  ref?: React.Ref<HTMLDivElement>;
  trailingItems?: React.ReactNode;
}) {
  const {
    dispatch,
    handleSearch,
    disabled,
    query,
    setDisplayAskSeerFeedback,
    caseInsensitive,
    onCaseInsensitiveClick,
  } = useSearchQueryBuilder();

  if (disabled) {
    return null;
  }

  const isCaseInsensitive = caseInsensitive === true;
  const caseInsensitiveLabel = isCaseInsensitive ? t('Match case') : t('Ignore case');

  return (
    <ButtonsWrapper ref={ref}>
      {trailingItems}
      {defined(onCaseInsensitiveClick) ? (
        <Tooltip title={caseInsensitiveLabel}>
          <ActionButton
            aria-label={caseInsensitiveLabel}
            aria-pressed={isCaseInsensitive}
            size="zero"
            icon={<IconCase variant={isCaseInsensitive ? 'muted' : 'accent'} />}
            borderless
            active={!isCaseInsensitive}
            onClick={() => {
              onCaseInsensitiveClick?.(isCaseInsensitive ? null : true);
            }}
          />
        </Tooltip>
      ) : null}
      {query === '' ? null : (
        <ActionButton
          aria-label={t('Clear search query')}
          size="zero"
          icon={<IconClose />}
          borderless
          onClick={() => {
            setDisplayAskSeerFeedback(false);
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
  trailingItems,
  onChange,
}: SearchQueryBuilderProps) {
  const {parsedQuery, query, dispatch, wrapperRef, actionBarRef, size} =
    useSearchQueryBuilder();

  useOnChange({onChange});
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
        <PositionedSearchIconContainer>
          <SearchIcon size="sm" />
        </PositionedSearchIconContainer>
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
  gap: ${p => p.theme.space.xs};
`;

const ActionButton = styled(Button)<{active?: boolean}>`
  color: ${p => p.theme.subText};
  ${p =>
    p.active &&
    css`
      background-color: ${p.theme.colors.blue200};
    `}
`;

const PositionedSearchIconContainer = styled('div')`
  position: absolute;
  left: ${p => p.theme.space.lg};
  top: ${p => p.theme.space.sm};
`;

const SearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  height: 22px;
`;
