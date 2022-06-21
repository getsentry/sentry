import {Component, createRef} from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import {withRouter, WithRouterProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchRecentSearches, saveRecentSearch} from 'sentry/actionCreators/savedSearches';
import {Client} from 'sentry/api';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownLink from 'sentry/components/dropdownLink';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {
  FilterType,
  ParseResult,
  parseSearch,
  TermOperator,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {
  getKeyName,
  isWithinToken,
  treeResultLocator,
} from 'sentry/components/searchSyntax/utils';
import {
  DEFAULT_DEBOUNCE_DURATION,
  MAX_AUTOCOMPLETE_RELEASES,
  NEGATION_OPERATOR,
} from 'sentry/constants';
import {IconClose, IconEllipsis, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import space from 'sentry/styles/space';
import {Organization, SavedSearchType, Tag, User} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import getDynamicComponent from 'sentry/utils/getDynamicComponent';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import {ActionButton} from './actions';
import SearchDropdown from './searchDropdown';
import SearchHotkeysListener from './searchHotkeysListener';
import {ItemType, SearchGroup, SearchItem, Shortcut, ShortcutType} from './types';
import {
  addSpace,
  createSearchGroups,
  filterSearchGroupsByIndex,
  generateOperatorEntryMap,
  getValidOps,
  removeSpace,
  shortcuts,
} from './utils';

const DROPDOWN_BLUR_DURATION = 200;

/**
 * The max width in pixels of the search bar at which the buttons will
 * have overflowed into the dropdown.
 */
const ACTION_OVERFLOW_WIDTH = 400;

/**
 * Actions are moved to the overflow dropdown after each pixel step is reached.
 */
const ACTION_OVERFLOW_STEPS = 75;

const makeQueryState = (query: string) => ({
  query,
  parsedQuery: parseSearch(query),
});

const generateOpAutocompleteGroup = (
  validOps: readonly TermOperator[],
  tagName: string
): AutocompleteGroup => {
  const operatorMap = generateOperatorEntryMap(tagName);
  const operatorItems = validOps.map(op => operatorMap[op]);
  return {
    searchItems: operatorItems,
    recentSearchItems: undefined,
    tagName: '',
    type: ItemType.TAG_OPERATOR,
  };
};

const escapeValue = (value: string): string => {
  // Wrap in quotes if there is a space
  return value.includes(' ') || value.includes('"')
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
};

type ActionProps = {
  api: Client;
  /**
   * The organization
   */
  organization: Organization;
  /**
   * The current query
   */
  query: string;
  /**
   * Render the actions as a menu item
   */
  menuItemVariant?: boolean;
  /**
   * The saved search type passed to the search bar
   */
  savedSearchType?: SavedSearchType;
};

type ActionBarItem = {
  /**
   * The action component to render
   */
  Action: React.ComponentType<ActionProps>;
  /**
   * Name of the action
   */
  key: string;
};

type AutocompleteGroup = {
  recentSearchItems: SearchItem[] | undefined;
  searchItems: SearchItem[];
  tagName: string;
  type: ItemType;
};

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  /**
   * Additional components to render as actions on the right of the search bar
   */
  actionBarItems?: ActionBarItem[];
  className?: string;

  defaultQuery?: string;
  /**
   * Search items to display when there's no tag key. Is a tuple of search
   * items and recent search items
   */
  defaultSearchItems?: [SearchItem[], SearchItem[]];
  /**
   * Disabled control (e.g. read-only)
   */
  disabled?: boolean;
  dropdownClassName?: string;
  /**
   * If true, excludes the environment tag from the autocompletion list. This
   * is because we don't want to treat environment as a tag in some places such
   * as the stream view where it is a top level concept
   */
  excludeEnvironment?: boolean;
  /**
   * A function to get documentation for a field
   */
  getFieldDoc?: (key: string) => React.ReactNode;
  /**
   * List user's recent searches
   */
  hasRecentSearches?: boolean;
  /**
   * Allows additional content to be played before the search bar and icon
   */
  inlineLabel?: React.ReactNode;
  /**
   * Maximum height for the search dropdown menu
   */
  maxMenuHeight?: number;
  /**
   * Used to enforce length on the query
   */
  maxQueryLength?: number;
  /**
   * Maximum number of search items to display or a falsey value for no
   * maximum
   */
  maxSearchItems?: number;
  /**
   * While the data is unused, this list of members can be updated to
   * trigger re-renders.
   */
  members?: User[];
  /**
   * Called when the search is blurred
   */
  onBlur?: (value: string) => void;
  /**
   * Called when the search input changes
   */
  onChange?: (value: string, e: React.ChangeEvent) => void;
  /**
   * Get a list of recent searches for the current query
   */
  onGetRecentSearches?: (query: string) => Promise<SearchItem[]>;
  /**
   * Get a list of tag values for the passed tag
   */
  onGetTagValues?: (tag: Tag, query: string, params: object) => Promise<string[]>;
  /**
   * Called on key down
   */
  onKeyDown?: (evt: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /**
   * Called when a recent search is saved
   */
  onSavedRecentSearch?: (query: string) => void;
  /**
   * Called when the user makes a search
   */
  onSearch?: (query: string) => void;
  /**
   * Input placeholder
   */
  placeholder?: string;
  /**
   * Prepare query value before filtering dropdown items
   */
  prepareQuery?: (query: string) => string;
  query?: string | null;
  /**
   * If this is defined, attempt to save search term scoped to the user and
   * the current org
   */
  savedSearchType?: SavedSearchType;
  /**
   * Indicates the usage of the search bar for analytics
   */
  searchSource?: string;
  /**
   * Type of supported tags
   */
  supportedTagType?: ItemType;
  /**
   * Map of tags
   */
  supportedTags?: {[key: string]: Tag};
  /**
   * Wrap the input with a form. Useful if search bar is used within a parent
   * form
   */
  useFormWrapper?: boolean;
};

type State = {
  /**
   * Index of the focused search item
   */
  activeSearchItem: number;
  flatSearchItems: SearchItem[];
  inputHasFocus: boolean;
  loading: boolean;
  /**
   * The number of actions that are not in the overflow menu.
   */
  numActionsVisible: number;
  /**
   * The query parsed into an AST. If the query fails to parse this will be
   * null.
   */
  parsedQuery: ParseResult | null;
  /**
   * The current search query in the input
   */
  query: string;
  searchGroups: SearchGroup[];
  /**
   * The current search term (or 'key') that that we will be showing
   * autocompletion for.
   */
  searchTerm: string;
  tags: Record<string, string>;
  /**
   * Indicates that we have a query that we've already determined not to have
   * any values. This is used to stop the autocompleter from querying if we
   * know we will find nothing.
   */
  noValueQuery?: string;
  /**
   * The query in the input since we last updated our autocomplete list.
   */
  previousQuery?: string;
};

class SmartSearchBar extends Component<Props, State> {
  static defaultProps = {
    defaultQuery: '',
    query: null,
    onSearch: function () {},
    excludeEnvironment: false,
    placeholder: t('Search for events, users, tags, and more'),
    supportedTags: {},
    defaultSearchItems: [[], []],
    useFormWrapper: true,
    savedSearchType: SavedSearchType.ISSUE,
  };

  state: State = {
    query: this.initialQuery,
    parsedQuery: parseSearch(this.initialQuery),
    searchTerm: '',
    searchGroups: [],
    flatSearchItems: [],
    activeSearchItem: -1,
    tags: {},
    inputHasFocus: false,
    loading: false,
    numActionsVisible: this.props.actionBarItems?.length ?? 0,
  };

  componentDidMount() {
    if (!window.ResizeObserver) {
      return;
    }

    if (this.containerRef.current === null) {
      return;
    }

    this.inputResizeObserver = new ResizeObserver(this.updateActionsVisible);
    this.inputResizeObserver.observe(this.containerRef.current);
  }

  componentDidUpdate(prevProps: Props) {
    const {query} = this.props;
    const {query: lastQuery} = prevProps;

    if (query !== lastQuery && (defined(query) || defined(lastQuery))) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(makeQueryState(addSpace(query ?? undefined)));
    }
  }

  componentWillUnmount() {
    this.inputResizeObserver?.disconnect();
    window.clearTimeout(this.blurTimeout);
  }

  get initialQuery() {
    const {query, defaultQuery} = this.props;
    return query !== null ? addSpace(query) : defaultQuery ?? '';
  }

  /**
   * Tracks the dropdown blur
   */
  blurTimeout: number | undefined = undefined;

  /**
   * Ref to the search element itself
   */
  searchInput = createRef<HTMLTextAreaElement>();

  /**
   * Ref to the search container
   */
  containerRef = createRef<HTMLDivElement>();

  /**
   * Used to determine when actions should be moved to the action overflow menu
   */
  inputResizeObserver: ResizeObserver | null = null;

  /**
   * Updates the numActionsVisible count as the search bar is resized
   */
  updateActionsVisible = (entries: ResizeObserverEntry[]) => {
    if (entries.length === 0) {
      return;
    }

    const entry = entries[0];
    const {width} = entry.contentRect;
    const actionCount = this.props.actionBarItems?.length ?? 0;

    const numActionsVisible = Math.min(
      actionCount,
      Math.floor(Math.max(0, width - ACTION_OVERFLOW_WIDTH) / ACTION_OVERFLOW_STEPS)
    );

    if (this.state.numActionsVisible === numActionsVisible) {
      return;
    }

    this.setState({numActionsVisible});
  };

  blur() {
    if (!this.searchInput.current) {
      return;
    }
    this.searchInput.current.blur();
  }

  async doSearch() {
    this.blur();

    if (!this.hasValidSearch) {
      return;
    }

    const query = removeSpace(this.state.query);
    const {
      onSearch,
      onSavedRecentSearch,
      api,
      organization,
      savedSearchType,
      searchSource,
    } = this.props;
    trackAdvancedAnalyticsEvent('search.searched', {
      organization,
      query,
      search_type: savedSearchType === 0 ? 'issues' : 'events',
      search_source: searchSource,
    });

    callIfFunction(onSearch, query);

    // Only save recent search query if we have a savedSearchType (also 0 is a valid value)
    // Do not save empty string queries (i.e. if they clear search)
    if (typeof savedSearchType === 'undefined' || !query) {
      return;
    }

    try {
      await saveRecentSearch(api, organization.slug, savedSearchType, query);

      if (onSavedRecentSearch) {
        onSavedRecentSearch(query);
      }
    } catch (err) {
      // Silently capture errors if it fails to save
      Sentry.captureException(err);
    }
  }

  moveToNextToken = (
    token: TokenResult<any> | undefined,
    filterTokens: TokenResult<Token.Filter>[]
  ) => {
    if (this.searchInput.current && filterTokens.length > 0) {
      this.searchInput.current.focus();

      let offset = filterTokens[0].location.end.offset;
      if (token) {
        const tokenIndex = filterTokens.findIndex(tok => tok === token);
        if (tokenIndex !== -1 && tokenIndex + 1 < filterTokens.length) {
          offset = filterTokens[tokenIndex + 1].location.end.offset;
        }
      }

      this.searchInput.current.selectionStart = offset;
      this.searchInput.current.selectionEnd = offset;
      this.updateAutoCompleteItems();
    }
  };

  runShortcut = (shortcut: Shortcut) => {
    const {query} = this.state;
    const token = this.cursorToken ?? undefined;

    const filterTokens = this.filterTokens;

    const {shortcutType, canRunShortcut} = shortcut;

    if (canRunShortcut(token, this.filterTokens.length)) {
      switch (shortcutType) {
        case ShortcutType.Delete: {
          if (token && filterTokens.length > 0) {
            const index = filterTokens.findIndex(tok => tok === token) ?? -1;

            if (typeof document.execCommand === 'function' && this.searchInput.current) {
              // Only use exec command if exists
              this.searchInput.current.focus();

              this.searchInput.current.selectionStart = token.location.start.offset;
              this.searchInput.current.selectionEnd = token.location.end.offset + 1;

              document.execCommand('insertText', false, '');
            } else {
              // Otherwise we fall back to the non-undo-able version
              const newQuery =
                // We trim to remove any remaining spaces
                query.slice(0, token.location.start.offset).trim() +
                (index > 0 && index < filterTokens.length - 1 ? ' ' : '') +
                query.slice(token.location.end.offset).trim();
              this.updateQuery(newQuery);
            }
          }

          break;
        }
        case ShortcutType.Negate: {
          if (token && token.type === Token.Filter) {
            if (token.negated) {
              if (
                typeof document.execCommand === 'function' &&
                this.searchInput.current
              ) {
                this.searchInput.current.focus();

                this.searchInput.current.selectionStart = token.location.start.offset;
                this.searchInput.current.selectionEnd = token.key.location.start.offset;

                document.execCommand('insertText', false, '');
              } else {
                const newQuery =
                  query.slice(0, token.location.start.offset) +
                  query.slice(token.key.location.start.offset);
                this.updateQuery(newQuery, this.cursorPosition - 1);
              }
            } else {
              if (
                typeof document.execCommand === 'function' &&
                this.searchInput.current
              ) {
                this.searchInput.current.focus();

                this.searchInput.current.selectionStart = token.location.start.offset;
                this.searchInput.current.selectionEnd = token.location.start.offset;

                document.execCommand('insertText', false, '!');
              } else {
                const newQuery =
                  query.slice(0, token.key.location.start.offset) +
                  '!' +
                  query.slice(token.key.location.start.offset);
                this.updateQuery(newQuery, this.cursorPosition + 1);
              }
            }
          }
          break;
        }
        case ShortcutType.Next: {
          this.moveToNextToken(token, filterTokens);

          break;
        }
        case ShortcutType.Previous: {
          this.moveToNextToken(token, filterTokens.reverse());

          break;
        }
        default:
          break;
      }
    }
  };

  onSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    this.doSearch();
  };

  clearSearch = () =>
    this.setState(makeQueryState(''), () =>
      callIfFunction(this.props.onSearch, this.state.query)
    );

  onQueryFocus = () => this.setState({inputHasFocus: true});

  onQueryBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // wait before closing dropdown in case blur was a result of clicking a
    // menu option
    const blurHandler = () => {
      this.blurTimeout = undefined;
      this.setState({inputHasFocus: false});
      callIfFunction(this.props.onBlur, e.target.value);
    };

    window.clearTimeout(this.blurTimeout);
    this.blurTimeout = window.setTimeout(blurHandler, DROPDOWN_BLUR_DURATION);
  };

  onQueryChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    const query = evt.target.value.replace('\n', '');

    this.setState(makeQueryState(query), this.updateAutoCompleteItems);
    callIfFunction(this.props.onChange, evt.target.value, evt);
  };

  /**
   * Prevent pasting extra spaces from formatted text
   */
  onPaste = (evt: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Cancel paste
    evt.preventDefault();

    // Get text representation of clipboard
    const text = evt.clipboardData.getData('text/plain').replace('\n', '').trim();

    // Create new query
    const currentQuery = this.state.query;
    const cursorPosStart = this.searchInput.current!.selectionStart;
    const cursorPosEnd = this.searchInput.current!.selectionEnd;
    const textBefore = currentQuery.substring(0, cursorPosStart);
    const textAfter = currentQuery.substring(cursorPosEnd, currentQuery.length);
    const mergedText = `${textBefore}${text}${textAfter}`;

    // Insert text manually
    this.setState(makeQueryState(mergedText), () => {
      this.updateAutoCompleteItems();
      // Update cursor position after updating text
      const newCursorPosition = cursorPosStart + text.length;
      this.searchInput.current!.selectionStart = newCursorPosition;
      this.searchInput.current!.selectionEnd = newCursorPosition;
    });
    callIfFunction(this.props.onChange, mergedText, evt);
  };

  onInputClick = () => this.updateAutoCompleteItems();

  /**
   * Handle keyboard navigation
   */
  onKeyDown = (evt: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const {onKeyDown} = this.props;
    const {key} = evt;

    callIfFunction(onKeyDown, evt);

    const hasSearchGroups = this.state.searchGroups.length > 0;
    const isSelectingDropdownItems = this.state.activeSearchItem !== -1;

    if ((key === 'ArrowDown' || key === 'ArrowUp') && hasSearchGroups) {
      evt.preventDefault();

      const {flatSearchItems, activeSearchItem} = this.state;
      const searchGroups = [...this.state.searchGroups];

      const [groupIndex, childrenIndex] = isSelectingDropdownItems
        ? filterSearchGroupsByIndex(searchGroups, activeSearchItem)
        : [];

      // Remove the previous 'active' property
      if (typeof groupIndex !== 'undefined') {
        if (
          childrenIndex !== undefined &&
          searchGroups[groupIndex]?.children?.[childrenIndex]
        ) {
          delete searchGroups[groupIndex].children[childrenIndex].active;
        }
      }

      const currIndex = isSelectingDropdownItems ? activeSearchItem : 0;
      const totalItems = flatSearchItems.length;

      // Move the selected index up/down
      const nextActiveSearchItem =
        key === 'ArrowUp'
          ? (currIndex - 1 + totalItems) % totalItems
          : isSelectingDropdownItems
          ? (currIndex + 1) % totalItems
          : 0;

      const [nextGroupIndex, nextChildrenIndex] = filterSearchGroupsByIndex(
        searchGroups,
        nextActiveSearchItem
      );

      // Make sure search items exist (e.g. both groups could be empty) and
      // attach the 'active' property to the item
      if (
        nextGroupIndex !== undefined &&
        nextChildrenIndex !== undefined &&
        searchGroups[nextGroupIndex]?.children
      ) {
        searchGroups[nextGroupIndex].children[nextChildrenIndex] = {
          ...searchGroups[nextGroupIndex].children[nextChildrenIndex],
          active: true,
        };
      }

      this.setState({searchGroups, activeSearchItem: nextActiveSearchItem});
    }

    if (
      (key === 'Tab' || key === 'Enter') &&
      isSelectingDropdownItems &&
      hasSearchGroups
    ) {
      evt.preventDefault();

      const {activeSearchItem, searchGroups} = this.state;
      const [groupIndex, childrenIndex] = filterSearchGroupsByIndex(
        searchGroups,
        activeSearchItem
      );
      const item =
        groupIndex !== undefined &&
        childrenIndex !== undefined &&
        searchGroups[groupIndex].children[childrenIndex];

      if (item) {
        if (item.callback) {
          item.callback();
        } else {
          this.onAutoComplete(item.value ?? '', item);
        }
      }
      return;
    }

    if (key === 'Enter' && !isSelectingDropdownItems) {
      this.doSearch();
      return;
    }

    const cursorToken = this.cursorToken;
    if (
      key === '[' &&
      cursorToken?.type === Token.Filter &&
      cursorToken.value.text.length === 0 &&
      isWithinToken(cursorToken.value, this.cursorPosition)
    ) {
      const {query} = this.state;
      evt.preventDefault();
      let clauseStart: null | number = null;
      let clauseEnd: null | number = null;
      // the new text that will exist between clauseStart and clauseEnd
      const replaceToken = '[]';
      const location = cursorToken.value.location;
      const keyLocation = cursorToken.key.location;
      // Include everything after the ':'
      clauseStart = keyLocation.end.offset + 1;
      clauseEnd = location.end.offset + 1;
      const beforeClause = query.substring(0, clauseStart);
      let endClause = query.substring(clauseEnd);
      // Add space before next clause if it exists
      if (endClause) {
        endClause = ` ${endClause}`;
      }
      const newQuery = `${beforeClause}${replaceToken}${endClause}`;
      // Place cursor between inserted brackets
      this.updateQuery(newQuery, beforeClause.length + replaceToken.length - 1);
      return;
    }
  };

  onKeyUp = (evt: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
      this.updateAutoCompleteItems();
    }

    // Other keys are managed at onKeyDown function
    if (evt.key !== 'Escape') {
      return;
    }

    evt.preventDefault();
    const isSelectingDropdownItems = this.state.activeSearchItem > -1;

    if (!isSelectingDropdownItems) {
      this.blur();
      return;
    }

    const {searchGroups, activeSearchItem} = this.state;
    const [groupIndex, childrenIndex] = isSelectingDropdownItems
      ? filterSearchGroupsByIndex(searchGroups, activeSearchItem)
      : [];

    if (groupIndex !== undefined && childrenIndex !== undefined) {
      delete searchGroups[groupIndex].children[childrenIndex].active;
    }

    this.setState({
      activeSearchItem: -1,
      searchGroups: [...this.state.searchGroups],
    });
  };

  /**
   * Check if any filters are invalid within the search query
   */
  get hasValidSearch() {
    const {parsedQuery} = this.state;

    // If we fail to parse be optimistic that it's valid
    if (parsedQuery === null) {
      return true;
    }

    return treeResultLocator<boolean>({
      tree: parsedQuery,
      noResultValue: true,
      visitorTest: ({token, returnResult, skipToken}) =>
        token.type !== Token.Filter
          ? null
          : token.invalid
          ? returnResult(false)
          : skipToken,
    });
  }

  /**
   * Get the active filter or free text actively focused.
   */
  get cursorToken() {
    const matchedTokens = [Token.Filter, Token.FreeText] as const;
    return this.findTokensAtCursor(matchedTokens);
  }

  /**
   * Get the active parsed text value
   */
  get cursorValue() {
    const matchedTokens = [Token.ValueText] as const;
    return this.findTokensAtCursor(matchedTokens);
  }

  /**
   * Get the current cursor position within the input
   */
  get cursorPosition() {
    if (!this.searchInput.current) {
      return -1;
    }

    // No cursor position when the input loses focus. This is important for
    // updating the search highlighters active state
    if (!this.state.inputHasFocus) {
      return -1;
    }

    return this.searchInput.current.selectionStart ?? -1;
  }

  get filterTokens(): TokenResult<Token.Filter>[] {
    return (this.state.parsedQuery?.filter(tok => tok.type === Token.Filter) ??
      []) as TokenResult<Token.Filter>[];
  }

  /**
   * Finds tokens that exist at the current cursor position
   * @param matchedTokens acceptable list of tokens
   */
  findTokensAtCursor<T extends readonly Token[]>(matchedTokens: T) {
    const {parsedQuery} = this.state;

    if (parsedQuery === null) {
      return null;
    }

    const cursor = this.cursorPosition;

    return treeResultLocator<TokenResult<T[number]> | null>({
      tree: parsedQuery,
      noResultValue: null,
      visitorTest: ({token, returnResult, skipToken}) =>
        !matchedTokens.includes(token.type)
          ? null
          : isWithinToken(token, cursor)
          ? returnResult(token)
          : skipToken,
    });
  }

  /**
   * Returns array of possible key values that substring match `query`
   */
  getTagGroups(query: string): [SearchItem[], ItemType] {
    const {prepareQuery, supportedTagType, getFieldDoc} = this.props;

    const supportedTags = this.props.supportedTags ?? {};

    let tagKeys = Object.keys(supportedTags);

    if (query) {
      const preparedQuery =
        typeof prepareQuery === 'function' ? prepareQuery(query) : query;
      tagKeys = tagKeys.filter(key => key.indexOf(preparedQuery) > -1);
    }

    // If the environment feature is active and excludeEnvironment = true
    // then remove the environment key
    if (this.props.excludeEnvironment) {
      tagKeys = tagKeys.filter(key => key !== 'environment');
    }

    const accountedForSections = new Set<string>();

    const tagGroups = tagKeys
      .sort((a, b) => a.localeCompare(b))
      .flatMap((key, _, arr) => {
        const keyWithColon = `${key}:`;
        const sections = key.split('.');
        const kind = supportedTags[key]?.kind;
        const documentation = getFieldDoc?.(key) || '-';

        if (
          sections.length > 1 &&
          kind !== FieldValueKind.FUNCTION &&
          arr.filter(k => k.startsWith(sections[0])).length > 1
        ) {
          const [title] = sections;

          const groupHasMoreThanOne =
            arr.filter(k => k.startsWith(`${sections[0]}.`)).length > 1;

          const item: SearchItem = {
            value: keyWithColon,
            title: key,
            documentation,
            kind,
            isGrouped: groupHasMoreThanOne,
            isChild: accountedForSections.has(title),
          };

          accountedForSections.add(title);

          return [item];
        }

        return [
          {
            value: keyWithColon,
            title: key,
            documentation,
            kind,
          },
        ];
      });

    return [tagGroups, supportedTagType ?? ItemType.TAG_KEY];
  }

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getTagValues = debounce(
    async (tag: Tag, query: string) => {
      // Strip double quotes if there are any
      query = query.replace(/"/g, '').trim();

      if (!this.props.onGetTagValues) {
        return [];
      }

      if (
        this.state.noValueQuery !== undefined &&
        query.startsWith(this.state.noValueQuery)
      ) {
        return [];
      }

      const {location} = this.props;
      const endpointParams = normalizeDateTimeParams(location.query);

      this.setState({loading: true});
      let values: string[] = [];

      try {
        values = await this.props.onGetTagValues(tag, query, endpointParams);
        this.setState({loading: false});
      } catch (err) {
        this.setState({loading: false});
        Sentry.captureException(err);
        return [];
      }

      if (tag.key === 'release:' && !values.includes('latest')) {
        values.unshift('latest');
      }

      const noValueQuery = values.length === 0 && query.length > 0 ? query : undefined;
      this.setState({noValueQuery});

      return values.map(value => {
        const escapedValue = escapeValue(value);
        return {
          value: escapedValue,
          desc: escapedValue,
          type: ItemType.TAG_VALUE,
        };
      });
    },
    DEFAULT_DEBOUNCE_DURATION,
    {leading: true}
  );

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with results
   */
  getPredefinedTagValues = (tag: Tag, query: string): SearchItem[] =>
    (tag.values ?? [])
      .filter(value => value.indexOf(query) > -1)
      .map((value, i) => {
        const escapedValue = escapeValue(value);
        return {
          value: escapedValue,
          desc: escapedValue,
          type: ItemType.TAG_VALUE,
          ignoreMaxSearchItems: tag.maxSuggestedValues
            ? i < tag.maxSuggestedValues
            : false,
        };
      });

  /**
   * Get recent searches
   */
  getRecentSearches = debounce(
    async () => {
      const {savedSearchType, hasRecentSearches, onGetRecentSearches} = this.props;

      // `savedSearchType` can be 0
      if (!defined(savedSearchType) || !hasRecentSearches) {
        return [];
      }

      const fetchFn = onGetRecentSearches || this.fetchRecentSearches;
      return await fetchFn(this.state.query);
    },
    DEFAULT_DEBOUNCE_DURATION,
    {leading: true}
  );

  fetchRecentSearches = async (fullQuery: string): Promise<SearchItem[]> => {
    const {api, organization, savedSearchType} = this.props;
    if (savedSearchType === undefined) {
      return [];
    }

    try {
      const recentSearches: any[] = await fetchRecentSearches(
        api,
        organization.slug,
        savedSearchType,
        fullQuery
      );

      // If `recentSearches` is undefined or not an array, the function will
      // return an array anyway
      return recentSearches.map(searches => ({
        desc: searches.query,
        value: searches.query,
        type: ItemType.RECENT_SEARCH,
      }));
    } catch (e) {
      Sentry.captureException(e);
    }

    return [];
  };

  getReleases = debounce(
    async (tag: Tag, query: string) => {
      const releasePromise = this.fetchReleases(query);

      const tags = this.getPredefinedTagValues(tag, query);
      const tagValues = tags.map<SearchItem>(v => ({
        ...v,
        type: ItemType.FIRST_RELEASE,
      }));

      const releases = await releasePromise;
      const releaseValues = releases.map<SearchItem>((r: any) => ({
        value: r.shortVersion,
        desc: r.shortVersion,
        type: ItemType.FIRST_RELEASE,
      }));

      return [...tagValues, ...releaseValues];
    },
    DEFAULT_DEBOUNCE_DURATION,
    {leading: true}
  );

  /**
   * Fetches latest releases from a organization/project. Returns an empty array
   * if an error is encountered.
   */
  fetchReleases = async (releaseVersion: string): Promise<any[]> => {
    const {api, location, organization} = this.props;

    const project = location && location.query ? location.query.projectId : undefined;

    const url = `/organizations/${organization.slug}/releases/`;
    const fetchQuery: {[key: string]: string | number} = {
      per_page: MAX_AUTOCOMPLETE_RELEASES,
    };

    if (releaseVersion) {
      fetchQuery.query = releaseVersion;
    }

    if (project) {
      fetchQuery.project = project;
    }

    try {
      return await api.requestPromise(url, {
        method: 'GET',
        query: fetchQuery,
      });
    } catch (e) {
      addErrorMessage(t('Unable to fetch releases'));
      Sentry.captureException(e);
    }

    return [];
  };

  async generateTagAutocompleteGroup(tagName: string): Promise<AutocompleteGroup> {
    const [tagKeys, tagType] = this.getTagGroups(tagName);
    const recentSearches = await this.getRecentSearches();

    return {
      searchItems: tagKeys,
      recentSearchItems: recentSearches ?? [],
      tagName,
      type: tagType,
    };
  }

  generateValueAutocompleteGroup = async (
    tagName: string,
    query: string
  ): Promise<AutocompleteGroup | null> => {
    const {prepareQuery, excludeEnvironment} = this.props;
    const supportedTags = this.props.supportedTags ?? {};

    const preparedQuery =
      typeof prepareQuery === 'function' ? prepareQuery(query) : query;

    // filter existing items immediately, until API can return
    // with actual tag value results
    const filteredSearchGroups = !preparedQuery
      ? this.state.searchGroups
      : this.state.searchGroups.filter(
          item => item.value && item.value.indexOf(preparedQuery) !== -1
        );

    this.setState({
      searchTerm: query,
      searchGroups: filteredSearchGroups,
    });

    const tag = supportedTags[tagName];

    if (!tag) {
      return {
        searchItems: [
          {
            type: ItemType.INVALID_TAG,
            desc: tagName,
            callback: () =>
              window.open(
                'https://docs.sentry.io/product/sentry-basics/search/searchable-properties/'
              ),
          },
        ],
        recentSearchItems: [],
        tagName,
        type: ItemType.INVALID_TAG,
      };
    }

    // Ignore the environment tag if the feature is active and
    // excludeEnvironment = true
    if (excludeEnvironment && tagName === 'environment') {
      return null;
    }

    const fetchTagValuesFn =
      tag.key === 'firstRelease'
        ? this.getReleases
        : tag.predefined
        ? this.getPredefinedTagValues
        : this.getTagValues;

    const [tagValues, recentSearches] = await Promise.all([
      fetchTagValuesFn(tag, preparedQuery),
      this.getRecentSearches(),
    ]);

    return {
      searchItems: tagValues ?? [],
      recentSearchItems: recentSearches ?? [],
      tagName: tag.key,
      type: ItemType.TAG_VALUE,
    };
  };

  showDefaultSearches = async () => {
    const {query} = this.state;
    const [defaultSearchItems, defaultRecentItems] = this.props.defaultSearchItems!;

    if (!defaultSearchItems.length) {
      // Update searchTerm, otherwise <SearchDropdown> will have wrong state
      // (e.g. if you delete a query, the last letter will be highlighted if `searchTerm`
      // does not get updated)
      this.setState({searchTerm: query});

      const [tagKeys, tagType] = this.getTagGroups('');
      const recentSearches = await this.getRecentSearches();

      this.updateAutoCompleteState(tagKeys, recentSearches ?? [], '', tagType);
      return;
    }
    // cursor on whitespace show default "help" search terms
    this.setState({searchTerm: ''});

    this.updateAutoCompleteState(
      defaultSearchItems,
      defaultRecentItems,
      '',
      ItemType.DEFAULT
    );
    return;
  };

  updateAutoCompleteFromAst = async () => {
    const cursor = this.cursorPosition;
    const cursorToken = this.cursorToken;

    if (!cursorToken) {
      this.showDefaultSearches();
      return;
    }

    if (cursorToken.type === Token.Filter) {
      const tagName = getKeyName(cursorToken.key, {aggregateWithArgs: true});
      // check if we are on the tag, value, or operator
      if (isWithinToken(cursorToken.value, cursor)) {
        const node = cursorToken.value;
        const cursorValue = this.cursorValue;
        let searchText = cursorValue?.text ?? node.text;
        if (searchText === '[]' || cursorValue === null) {
          searchText = '';
        }

        const valueGroup = await this.generateValueAutocompleteGroup(tagName, searchText);
        const autocompleteGroups = valueGroup ? [valueGroup] : [];
        // show operator group if at beginning of value
        if (cursor === node.location.start.offset) {
          const opGroup = generateOpAutocompleteGroup(getValidOps(cursorToken), tagName);
          if (valueGroup?.type !== ItemType.INVALID_TAG) {
            autocompleteGroups.unshift(opGroup);
          }
        }
        this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
        return;
      }

      if (isWithinToken(cursorToken.key, cursor)) {
        const node = cursorToken.key;
        const autocompleteGroups = [await this.generateTagAutocompleteGroup(tagName)];
        // show operator group if at end of key
        if (cursor === node.location.end.offset) {
          const opGroup = generateOpAutocompleteGroup(getValidOps(cursorToken), tagName);
          autocompleteGroups.unshift(opGroup);
        }
        this.setState({searchTerm: tagName});
        this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
        return;
      }

      // show operator autocomplete group
      const opGroup = generateOpAutocompleteGroup(getValidOps(cursorToken), tagName);
      this.updateAutoCompleteStateMultiHeader([opGroup]);
      return;
    }

    if (cursorToken.type === Token.FreeText) {
      const lastToken = cursorToken.text.trim().split(' ').pop() ?? '';
      const keyText = lastToken.replace(new RegExp(`^${NEGATION_OPERATOR}`), '');
      const autocompleteGroups = [await this.generateTagAutocompleteGroup(keyText)];
      this.setState({searchTerm: keyText});
      this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
      return;
    }
  };

  updateAutoCompleteItems = () => {
    window.clearTimeout(this.blurTimeout);
    this.blurTimeout = undefined;

    this.updateAutoCompleteFromAst();
  };

  /**
   * Updates autocomplete dropdown items and autocomplete index state
   *
   * @param searchItems List of search item objects with keys: title, desc, value
   * @param recentSearchItems List of recent search items, same format as searchItem
   * @param tagName The current tag name in scope
   * @param type Defines the type/state of the dropdown menu items
   */
  updateAutoCompleteState(
    searchItems: SearchItem[],
    recentSearchItems: SearchItem[],
    tagName: string,
    type: ItemType
  ) {
    const {hasRecentSearches, maxSearchItems, maxQueryLength} = this.props;
    const {query} = this.state;

    const queryCharsLeft =
      maxQueryLength && query ? maxQueryLength - query.length : undefined;

    const searchGroups = createSearchGroups(
      searchItems,
      hasRecentSearches ? recentSearchItems : undefined,
      tagName,
      type,
      maxSearchItems,
      queryCharsLeft,
      true
    );

    this.setState(searchGroups);
  }

  /**
   * Updates autocomplete dropdown items and autocomplete index state
   *
   * @param groups Groups that will be used to populate the autocomplete dropdown
   */
  updateAutoCompleteStateMultiHeader = (groups: AutocompleteGroup[]) => {
    const {hasRecentSearches, maxSearchItems, maxQueryLength} = this.props;
    const {query} = this.state;
    const queryCharsLeft =
      maxQueryLength && query ? maxQueryLength - query.length : undefined;

    const searchGroups = groups
      .map(({searchItems, recentSearchItems, tagName, type}) =>
        createSearchGroups(
          searchItems,
          hasRecentSearches ? recentSearchItems : undefined,
          tagName,
          type,
          maxSearchItems,
          queryCharsLeft,
          false
        )
      )
      .reduce(
        (acc, item) => ({
          searchGroups: [...acc.searchGroups, ...item.searchGroups],
          flatSearchItems: [...acc.flatSearchItems, ...item.flatSearchItems],
          activeSearchItem: -1,
        }),
        {
          searchGroups: [] as SearchGroup[],
          flatSearchItems: [] as SearchItem[],
          activeSearchItem: -1,
        }
      );

    this.setState(searchGroups);
  };

  updateQuery = (newQuery: string, cursorPosition?: number) =>
    this.setState(makeQueryState(newQuery), () => {
      // setting a new input value will lose focus; restore it
      if (this.searchInput.current) {
        this.searchInput.current.focus();
        if (cursorPosition) {
          this.searchInput.current.selectionStart = cursorPosition;
          this.searchInput.current.selectionEnd = cursorPosition;
        }
      }
      // then update the autocomplete box with new items
      this.updateAutoCompleteItems();
      this.props.onChange?.(newQuery, new MouseEvent('click') as any);
    });

  onAutoCompleteFromAst = (replaceText: string, item: SearchItem) => {
    const cursor = this.cursorPosition;
    const {query} = this.state;

    const cursorToken = this.cursorToken;

    if (!cursorToken) {
      this.updateQuery(`${query}${replaceText}`);
      return;
    }

    // the start and end of what to replace
    let clauseStart: null | number = null;
    let clauseEnd: null | number = null;
    // the new text that will exist between clauseStart and clauseEnd
    let replaceToken = replaceText;
    if (cursorToken.type === Token.Filter) {
      if (item.type === ItemType.TAG_OPERATOR) {
        trackAdvancedAnalyticsEvent('search.operator_autocompleted', {
          organization: this.props.organization,
          query: removeSpace(query),
          search_operator: replaceText,
          search_type: this.props.savedSearchType === 0 ? 'issues' : 'events',
        });
        const valueLocation = cursorToken.value.location;
        clauseStart = cursorToken.location.start.offset;
        clauseEnd = valueLocation.start.offset;
        if (replaceText === '!:') {
          replaceToken = `!${cursorToken.key.text}:`;
        } else {
          replaceToken = `${cursorToken.key.text}${replaceText}`;
        }
      } else if (isWithinToken(cursorToken.value, cursor)) {
        const valueToken = this.cursorValue ?? cursorToken.value;
        const location = valueToken.location;

        if (cursorToken.filter === FilterType.TextIn) {
          // Current value can be null when adding a 2nd value
          //             ▼ cursor
          // key:[value1, ]
          const currentValueNull = this.cursorValue === null;
          clauseStart = currentValueNull
            ? this.cursorPosition
            : valueToken.location.start.offset;
          clauseEnd = currentValueNull
            ? this.cursorPosition
            : valueToken.location.end.offset;
        } else {
          const keyLocation = cursorToken.key.location;
          clauseStart = keyLocation.end.offset + 1;
          clauseEnd = location.end.offset + 1;
          // The user tag often contains : within its value and we need to quote it.
          if (getKeyName(cursorToken.key) === 'user') {
            replaceToken = `"${replaceText.trim()}"`;
          }
          // handle using autocomplete with key:[]
          if (valueToken.text === '[]') {
            clauseStart += 1;
            clauseEnd -= 2;
          } else {
            replaceToken += ' ';
          }
        }
      } else if (isWithinToken(cursorToken.key, cursor)) {
        const location = cursorToken.key.location;
        clauseStart = location.start.offset;
        // If the token is a key, then trim off the end to avoid duplicate ':'
        clauseEnd = location.end.offset + 1;
      }
    }

    if (cursorToken.type === Token.FreeText) {
      const startPos = cursorToken.location.start.offset;
      clauseStart = cursorToken.text.startsWith(NEGATION_OPERATOR)
        ? startPos + 1
        : startPos;
      clauseEnd = cursorToken.location.end.offset;
    }

    if (clauseStart !== null && clauseEnd !== null) {
      const beforeClause = query.substring(0, clauseStart);
      const endClause = query.substring(clauseEnd);
      const newQuery = `${beforeClause}${replaceToken}${endClause}`;
      this.updateQuery(newQuery, beforeClause.length + replaceToken.length);
    }
  };

  onAutoComplete = (replaceText: string, item: SearchItem) => {
    if (item.type === ItemType.RECENT_SEARCH) {
      trackAdvancedAnalyticsEvent('search.searched', {
        organization: this.props.organization,
        query: replaceText,
        search_type: this.props.savedSearchType === 0 ? 'issues' : 'events',
        search_source: 'recent_search',
      });

      this.setState(makeQueryState(replaceText), () => {
        // Propagate onSearch and save to recent searches
        this.doSearch();
      });

      return;
    }

    this.onAutoCompleteFromAst(replaceText, item);
  };

  render() {
    const {
      api,
      className,
      savedSearchType,
      dropdownClassName,
      actionBarItems,
      organization,
      placeholder,
      disabled,
      useFormWrapper,
      inlineLabel,
      maxQueryLength,
      maxMenuHeight,
    } = this.props;

    const {
      query,
      parsedQuery,
      searchGroups,
      searchTerm,
      inputHasFocus,
      numActionsVisible,
      loading,
    } = this.state;

    const input = (
      <SearchInput
        type="text"
        placeholder={placeholder}
        id="smart-search-input"
        data-test-id="smart-search-input"
        name="query"
        ref={this.searchInput}
        autoComplete="off"
        value={query}
        onFocus={this.onQueryFocus}
        onBlur={this.onQueryBlur}
        onKeyUp={this.onKeyUp}
        onKeyDown={this.onKeyDown}
        onChange={this.onQueryChange}
        onClick={this.onInputClick}
        onPaste={this.onPaste}
        disabled={disabled}
        maxLength={maxQueryLength}
        spellCheck={false}
      />
    );

    // Segment actions into visible and overflowed groups
    const actionItems = actionBarItems ?? [];
    const actionProps = {
      api,
      organization,
      query,
      savedSearchType,
    };

    const visibleActions = actionItems
      .slice(0, numActionsVisible)
      .map(({key, Action}) => <Action key={key} {...actionProps} />);

    const overflowedActions = actionItems
      .slice(numActionsVisible)
      .map(({key, Action}) => <Action key={key} {...actionProps} menuItemVariant />);

    const cursor = this.cursorPosition;

    const visibleShortcuts = shortcuts.filter(
      shortcut =>
        shortcut.hotkeys &&
        shortcut.canRunShortcut(this.cursorToken, this.filterTokens.length)
    );

    return (
      <Container
        ref={this.containerRef}
        className={className}
        inputHasFocus={inputHasFocus}
      >
        <SearchHotkeysListener
          visibleShortcuts={visibleShortcuts}
          runShortcut={this.runShortcut}
        />
        <SearchLabel htmlFor="smart-search-input" aria-label={t('Search events')}>
          <IconSearch />
          {inlineLabel}
        </SearchLabel>

        <InputWrapper>
          <Highlight>
            {parsedQuery !== null ? (
              <HighlightQuery
                parsedQuery={parsedQuery}
                cursorPosition={cursor === -1 ? undefined : cursor}
              />
            ) : (
              query
            )}
          </Highlight>
          {useFormWrapper ? <form onSubmit={this.onSubmit}>{input}</form> : input}
        </InputWrapper>

        <ActionsBar gap={0.5}>
          {query !== '' && (
            <ActionButton
              onClick={this.clearSearch}
              icon={<IconClose size="xs" />}
              title={t('Clear search')}
              aria-label={t('Clear search')}
            />
          )}
          {visibleActions}
          {overflowedActions.length > 0 && (
            <DropdownLink
              anchorRight
              caret={false}
              title={
                <ActionButton
                  aria-label={t('Show more')}
                  icon={<VerticalEllipsisIcon size="xs" />}
                />
              }
            >
              {overflowedActions}
            </DropdownLink>
          )}
        </ActionsBar>

        {(loading || searchGroups.length > 0) && (
          <SearchDropdown
            css={{display: inputHasFocus ? 'block' : 'none'}}
            className={dropdownClassName}
            items={searchGroups}
            onClick={this.onAutoComplete}
            loading={loading}
            searchSubstring={searchTerm}
            runShortcut={this.runShortcut}
            visibleShortcuts={visibleShortcuts}
            maxMenuHeight={maxMenuHeight}
          />
        )}
      </Container>
    );
  }
}

type ContainerState = {
  members: ReturnType<typeof MemberListStore.getAll>;
};

class SmartSearchBarContainer extends Component<Props, ContainerState> {
  state: ContainerState = {
    members: MemberListStore.getAll(),
  };

  componentWillUnmount() {
    this.unsubscribe();
  }

  unsubscribe = MemberListStore.listen(
    (members: ContainerState['members']) => this.setState({members}),
    undefined
  );

  render() {
    // SmartSearchBar doesn't use members, but we forward it to cause a re-render.
    return <SmartSearchBar {...this.props} members={this.state.members} />;
  }
}

export default withApi(withRouter(withOrganization(SmartSearchBarContainer)));

export {SmartSearchBar, Props as SmartSearchBarProps};

const Container = styled('div')<{inputHasFocus: boolean}>`
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset ${p => p.theme.dropShadowLight};
  background: ${p => p.theme.background};
  padding: 7px ${space(1)};
  position: relative;
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(1)};
  align-items: start;

  border-radius: ${p => p.theme.borderRadius};

  .show-sidebar & {
    background: ${p => p.theme.backgroundSecondary};
  }

  ${p =>
    p.inputHasFocus &&
    `
    border-color: ${p.theme.focusBorder};
    box-shadow: 0 0 0 1px ${p.theme.focusBorder};
  `}
`;

const SearchLabel = styled('label')`
  display: flex;
  padding: ${space(0.5)} 0;
  margin: 0;
  color: ${p => p.theme.gray300};
`;

const InputWrapper = styled('div')`
  position: relative;
`;

const Highlight = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  user-select: none;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 25px;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
`;

const SearchInput = styled(
  getDynamicComponent<typeof TextareaAutosize>({
    value: TextareaAutosize,
    fixed: 'textarea',
  }),
  {
    shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
  }
)`
  position: relative;
  display: flex;
  resize: none;
  outline: none;
  border: 0;
  width: 100%;
  padding: 0;
  line-height: 25px;
  margin-bottom: -1px;
  background: transparent;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
  caret-color: ${p => p.theme.subText};
  color: transparent;

  &::selection {
    background: rgba(0, 0, 0, 0.2);
  }
  &::placeholder {
    color: ${p => p.theme.formPlaceholder};
  }

  [disabled] {
    color: ${p => p.theme.disabled};
  }
`;

const ActionsBar = styled(ButtonBar)`
  height: ${space(2)};
  margin: ${space(0.5)} 0;
`;

const VerticalEllipsisIcon = styled(IconEllipsis)`
  transform: rotate(90deg);
`;
