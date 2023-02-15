import {Component, createRef, VFC} from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import {WithRouterProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchRecentSearches, saveRecentSearch} from 'sentry/actionCreators/savedSearches';
import {Client} from 'sentry/api';
import ButtonBar from 'sentry/components/buttonBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {
  FilterType,
  ParseResult,
  parseSearch,
  SearchConfig,
  TermOperator,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {
  getKeyName,
  isOperator,
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
import {space} from 'sentry/styles/space';
import {Organization, SavedSearchType, Tag, TagCollection, User} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {FieldDefinition, FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import getDynamicComponent from 'sentry/utils/getDynamicComponent';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import {DropdownMenu, MenuItemProps} from '../dropdownMenu';

import {ActionButton} from './actionButton';
import SearchBarDatePicker from './searchBarDatePicker';
import SearchDropdown from './searchDropdown';
import SearchHotkeysListener from './searchHotkeysListener';
import {
  AutocompleteGroup,
  ItemType,
  SearchGroup,
  SearchItem,
  Shortcut,
  ShortcutType,
} from './types';
import {
  addSpace,
  createSearchGroups,
  filterKeysFromQuery,
  generateOperatorEntryMap,
  getDateTagAutocompleteGroups,
  getSearchConfigFromCustomPerformanceMetrics,
  getSearchGroupWithItemMarkedActive,
  getTagItemsFromKeys,
  getValidOps,
  removeSpace,
  shortcuts,
} from './utils';

/**
 * The max width in pixels of the search bar at which the buttons will
 * have overflowed into the dropdown.
 */
const ACTION_OVERFLOW_WIDTH = 400;

/**
 * Actions are moved to the overflow dropdown after each pixel step is reached.
 */
const ACTION_OVERFLOW_STEPS = 75;

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

export type ActionProps = {
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
   * The saved search type passed to the search bar
   */
  savedSearchType?: SavedSearchType;
};

export type ActionBarItem = {
  /**
   * Name of the action
   */
  key: string;
  makeAction: (props: ActionProps) => {Button: VFC; menuItem: MenuItemProps};
};

type DefaultProps = {
  defaultQuery: string;
  /**
   * Search items to display when there's no tag key. Is a tuple of search
   * items and recent search items
   */
  defaultSearchItems: [SearchItem[], SearchItem[]];
  /**
   * The lookup strategy for field definitions.
   * Each SmartSearchBar instance can support a different list of fields and tags,
   * their definitions may not overlap.
   */
  fieldDefinitionGetter: (key: string) => FieldDefinition | null;
  id: string;
  includeLabel: boolean;
  name: string;
  /**
   * Called when the user makes a search
   */
  onSearch: (query: string) => void;
  /**
   * Input placeholder
   */
  placeholder: string;
  query: string | null;
  /**
   * If this is defined, attempt to save search term scoped to the user and
   * the current org
   */
  savedSearchType: SavedSearchType;
  /**
   * Map of tags
   */
  supportedTags: TagCollection;
  /**
   * Wrap the input with a form. Useful if search bar is used within a parent
   * form
   */
  useFormWrapper: boolean;
};

type Props = WithRouterProps &
  Partial<DefaultProps> & {
    api: Client;
    organization: Organization;
    /**
     * Additional components to render as actions on the right of the search bar
     */
    actionBarItems?: ActionBarItem[];
    className?: string;

    /**
     * Custom Performance Metrics for query string unit parsing
     */
    customPerformanceMetrics?: CustomMeasurementCollection;
    /**
     * Disabled control (e.g. read-only)
     */
    disabled?: boolean;
    dropdownClassName?: string;
    /**
     * A list of tags to exclude from the autocompletion list, for ex environment may be excluded
     * because we don't want to treat environment as a tag in some places such
     * as the stream view where it is a top level concept
     */
    excludedTags?: string[];
    /**
     * List user's recent searches
     */
    hasRecentSearches?: boolean;
    /**
     * Whether or not to highlight unsupported tags red
     */
    highlightUnsupportedTags?: boolean;
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
     * Called when the search input is blurred.
     * Note that the input may be blurred when the user selects an autocomplete
     * value - if you don't want that, onClose may be a better option.
     */
    onBlur?: (value: string) => void;
    /**
     * Called when the search input changes
     */
    onChange?: (value: string, e: React.ChangeEvent) => void;
    /**
     * Called when the user has closed the search dropdown.
     * Occurs on escape, tab, or clicking outside the component.
     */
    onClose?: (value: string, additionalSearchBarState: {validSearch: boolean}) => void;
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
     * Prepare query value before filtering dropdown items
     */
    prepareQuery?: (query: string) => string;
    /**
     * Indicates the usage of the search bar for analytics
     */
    searchSource?: string;
    /**
     * Type of supported tags
     */
    supportedTagType?: ItemType;
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

  /**
   * Boolean indicating if dropdown should be shown
   */
  showDropdown: boolean;
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

class SmartSearchBar extends Component<DefaultProps & Props, State> {
  static defaultProps = {
    id: 'smart-search-input',
    includeLabel: true,
    defaultQuery: '',
    query: null,
    onSearch: function () {},
    name: 'query',
    placeholder: t('Search for events, users, tags, and more'),
    supportedTags: {},
    defaultSearchItems: [[], []],
    useFormWrapper: true,
    savedSearchType: SavedSearchType.ISSUE,
    fieldDefinitionGetter: getFieldDefinition,
  } as DefaultProps;

  state: State = {
    query: this.initialQuery,
    showDropdown: false,
    parsedQuery: parseSearch(this.initialQuery, {
      ...getSearchConfigFromCustomPerformanceMetrics(this.props.customPerformanceMetrics),
      supportedTags: this.props.supportedTags,
      validateKeys: this.props.highlightUnsupportedTags,
    }),
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
    const {query, customPerformanceMetrics, actionBarItems} = this.props;
    const {
      query: lastQuery,
      customPerformanceMetrics: lastCustomPerformanceMetrics,
      actionBarItems: lastAcionBarItems,
    } = prevProps;

    if (
      (query !== lastQuery && (defined(query) || defined(lastQuery))) ||
      customPerformanceMetrics !== lastCustomPerformanceMetrics
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(this.makeQueryState(addSpace(query ?? undefined)));
    }

    if (lastAcionBarItems?.length !== actionBarItems?.length) {
      this.setState({numActionsVisible: actionBarItems?.length ?? 0});
    }
  }

  componentWillUnmount() {
    this.inputResizeObserver?.disconnect();
    document.removeEventListener('pointerup', this.onBackgroundPointerUp);
  }

  get initialQuery() {
    const {query, defaultQuery} = this.props;
    return query !== null ? addSpace(query) : defaultQuery ?? '';
  }

  makeQueryState(query: string) {
    const additionalConfig: Partial<SearchConfig> = {
      ...getSearchConfigFromCustomPerformanceMetrics(this.props.customPerformanceMetrics),
      supportedTags: this.props.supportedTags,
      validateKeys: this.props.highlightUnsupportedTags,
    };
    return {
      query,
      parsedQuery: parseSearch(query, additionalConfig),
    };
  }
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
   * Only closes the dropdown when pointer events occur outside of this component
   */
  onBackgroundPointerUp = (e: PointerEvent) => {
    if (this.containerRef.current?.contains(e.target as Node)) {
      return;
    }

    this.close();
  };

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
    this.close();
  }

  async doSearch() {
    this.blur();

    const query = removeSpace(this.state.query);
    const {organization, savedSearchType, searchSource} = this.props;

    if (!this.hasValidSearch) {
      trackAdvancedAnalyticsEvent('search.search_with_invalid', {
        organization,
        query,
        search_type: savedSearchType === 0 ? 'issues' : 'events',
        search_source: searchSource,
      });
      return;
    }

    const {onSearch, onSavedRecentSearch, api} = this.props;
    trackAdvancedAnalyticsEvent('search.searched', {
      organization,
      query,
      search_type: savedSearchType === 0 ? 'issues' : 'events',
      search_source: searchSource,
    });

    onSearch?.(query);

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

  moveToNextToken = (filterTokens: TokenResult<Token.Filter>[]) => {
    const token = this.cursorToken;

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

  deleteToken = () => {
    const {query} = this.state;
    const token = this.cursorToken ?? undefined;
    const filterTokens = this.filterTokens;
    const hasExecCommand = typeof document.execCommand === 'function';

    if (token && filterTokens.length > 0) {
      const index = filterTokens.findIndex(tok => tok === token) ?? -1;
      const newQuery =
        // We trim to remove any remaining spaces
        query.slice(0, token.location.start.offset).trim() +
        (index > 0 && index < filterTokens.length - 1 ? ' ' : '') +
        query.slice(token.location.end.offset).trim();

      if (this.searchInput.current) {
        // Only use exec command if exists
        this.searchInput.current.focus();

        this.searchInput.current.selectionStart = 0;
        this.searchInput.current.selectionEnd = query.length;

        // Because firefox doesn't support inserting an empty string, we insert a newline character instead
        // But because of this, only on firefox, if you delete the last token you won't be able to undo.
        if (
          (navigator.userAgent.toLowerCase().includes('firefox') &&
            newQuery.length === 0) ||
          !hasExecCommand ||
          !document.execCommand('insertText', false, newQuery)
        ) {
          // This will run either when newQuery is empty on firefox or when execCommand fails.
          this.updateQuery(newQuery);
        }
      }
    }
  };

  negateToken = () => {
    const {query} = this.state;
    const token = this.cursorToken ?? undefined;
    const hasExecCommand = typeof document.execCommand === 'function';

    if (token && token.type === Token.Filter) {
      if (token.negated) {
        if (this.searchInput.current) {
          this.searchInput.current.focus();

          const tokenCursorOffset = this.cursorPosition - token.key.location.start.offset;

          // Select the whole token so we can replace it.
          this.searchInput.current.selectionStart = token.location.start.offset;
          this.searchInput.current.selectionEnd = token.location.end.offset;

          // We can't call insertText with an empty string on Firefox, so we have to do this.
          if (
            !hasExecCommand ||
            !document.execCommand('insertText', false, token.text.slice(1))
          ) {
            // Fallback when execCommand fails
            const newQuery =
              query.slice(0, token.location.start.offset) +
              query.slice(token.key.location.start.offset);
            this.updateQuery(newQuery, this.cursorPosition - 1);
          }

          // Return the cursor to where it should be
          const newCursorPosition = token.location.start.offset + tokenCursorOffset;
          this.searchInput.current.selectionStart = newCursorPosition;
          this.searchInput.current.selectionEnd = newCursorPosition;
        }
      } else {
        if (this.searchInput.current) {
          this.searchInput.current.focus();

          const tokenCursorOffset = this.cursorPosition - token.key.location.start.offset;

          this.searchInput.current.selectionStart = token.location.start.offset;
          this.searchInput.current.selectionEnd = token.location.start.offset;

          if (!hasExecCommand || !document.execCommand('insertText', false, '!')) {
            // Fallback when execCommand fails
            const newQuery =
              query.slice(0, token.key.location.start.offset) +
              '!' +
              query.slice(token.key.location.start.offset);
            this.updateQuery(newQuery, this.cursorPosition + 1);
          }

          // Return the cursor to where it should be, +1 for the ! character we added
          const newCursorPosition = token.location.start.offset + tokenCursorOffset + 1;
          this.searchInput.current.selectionStart = newCursorPosition;
          this.searchInput.current.selectionEnd = newCursorPosition;
        }
      }
    }
  };

  logShortcutEvent = (shortcutType: ShortcutType, shortcutMethod: 'click' | 'hotkey') => {
    const {searchSource, savedSearchType, organization} = this.props;
    const {query} = this.state;
    trackAdvancedAnalyticsEvent('search.shortcut_used', {
      organization,
      search_type: savedSearchType === 0 ? 'issues' : 'events',
      search_source: searchSource,
      shortcut_method: shortcutMethod,
      shortcut_type: shortcutType,
      query,
    });
  };

  runShortcutOnClick = (shortcut: Shortcut) => {
    this.runShortcut(shortcut);
    this.logShortcutEvent(shortcut.shortcutType, 'click');
  };

  runShortcutOnHotkeyPress = (shortcut: Shortcut) => {
    this.runShortcut(shortcut);
    this.logShortcutEvent(shortcut.shortcutType, 'hotkey');
  };

  runShortcut = (shortcut: Shortcut) => {
    const token = this.cursorToken;
    const filterTokens = this.filterTokens;

    const {shortcutType, canRunShortcut} = shortcut;

    if (canRunShortcut(token, this.filterTokens.length)) {
      switch (shortcutType) {
        case ShortcutType.Delete: {
          this.deleteToken();
          break;
        }
        case ShortcutType.Negate: {
          this.negateToken();
          break;
        }
        case ShortcutType.Next: {
          this.moveToNextToken(filterTokens);
          break;
        }
        case ShortcutType.Previous: {
          this.moveToNextToken(filterTokens.reverse());
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

  clearSearch = () => {
    this.setState(this.makeQueryState(''), () => {
      this.close();
      this.props.onSearch?.(this.state.query);
    });
  };

  close = () => {
    this.setState({showDropdown: false});
    this.props.onClose?.(this.state.query, {validSearch: this.hasValidSearch});
    document.removeEventListener('pointerup', this.onBackgroundPointerUp);
  };

  open = () => {
    this.setState({showDropdown: true});
    document.addEventListener('pointerup', this.onBackgroundPointerUp);
  };

  onQueryFocus = () => {
    this.open();
    this.setState({inputHasFocus: true});
  };

  onQueryBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    this.setState({inputHasFocus: false});
    this.props.onBlur?.(e.target.value);
  };

  onQueryChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    const query = evt.target.value.replace('\n', '');

    this.setState(this.makeQueryState(query), this.updateAutoCompleteItems);
    this.props.onChange?.(evt.target.value, evt);
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
    this.setState(this.makeQueryState(mergedText), () => {
      this.updateAutoCompleteItems();
      // Update cursor position after updating text
      const newCursorPosition = cursorPosStart + text.length;
      this.searchInput.current!.selectionStart = newCursorPosition;
      this.searchInput.current!.selectionEnd = newCursorPosition;
    });
    callIfFunction(this.props.onChange, mergedText, evt);
  };

  onInputClick = () => {
    this.open();
    this.updateAutoCompleteItems();
  };

  /**
   * Handle keyboard navigation
   */
  onKeyDown = (evt: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const {onKeyDown} = this.props;
    const {key} = evt;

    onKeyDown?.(evt);

    const hasSearchGroups = this.state.searchGroups.length > 0;
    const isSelectingDropdownItems = this.state.activeSearchItem !== -1;

    if (!this.state.showDropdown && key !== 'Escape') {
      this.open();
    }

    if ((key === 'ArrowDown' || key === 'ArrowUp') && hasSearchGroups) {
      evt.preventDefault();

      const {flatSearchItems, activeSearchItem} = this.state;
      let searchGroups = [...this.state.searchGroups];

      const currIndex = isSelectingDropdownItems ? activeSearchItem : 0;
      const totalItems = flatSearchItems.length;

      // Move the selected index up/down
      const nextActiveSearchItem =
        key === 'ArrowUp'
          ? (currIndex - 1 + totalItems) % totalItems
          : isSelectingDropdownItems
          ? (currIndex + 1) % totalItems
          : 0;

      // Clear previous selection
      const prevItem = flatSearchItems[currIndex];
      searchGroups = getSearchGroupWithItemMarkedActive(searchGroups, prevItem, false);

      // Set new selection
      const activeItem = flatSearchItems[nextActiveSearchItem];
      searchGroups = getSearchGroupWithItemMarkedActive(searchGroups, activeItem, true);

      this.setState({searchGroups, activeSearchItem: nextActiveSearchItem});
    }

    if (
      (key === 'Tab' || key === 'Enter') &&
      isSelectingDropdownItems &&
      hasSearchGroups
    ) {
      evt.preventDefault();

      const {activeSearchItem, flatSearchItems} = this.state;

      const item = flatSearchItems[activeSearchItem];

      if (item) {
        if (item.callback) {
          item.callback();
        } else {
          this.onAutoComplete(item.value ?? '', item);
        }
      }
      return;
    }

    // If not selecting an item, allow tab to exit search and close the dropdown
    if (key === 'Tab' && !isSelectingDropdownItems) {
      this.close();
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

    if (!this.state.showDropdown) {
      this.blur();
      return;
    }

    const {flatSearchItems, activeSearchItem} = this.state;
    const isSelectingDropdownItems = this.state.activeSearchItem > -1;

    let searchGroups = [...this.state.searchGroups];
    if (isSelectingDropdownItems) {
      searchGroups = getSearchGroupWithItemMarkedActive(
        searchGroups,
        flatSearchItems[activeSearchItem],
        false
      );
    }

    this.setState({
      activeSearchItem: -1,
      searchGroups,
    });
    this.close();
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
   * Get the active filter
   */
  get cursorFilter() {
    const matchedTokens = [Token.Filter] as const;
    return this.findTokensAtCursor(matchedTokens);
  }

  get cursorValueIsoDate(): TokenResult<Token.ValueIso8601Date> | null {
    const matchedTokens = [Token.ValueIso8601Date] as const;
    return this.findTokensAtCursor(matchedTokens);
  }

  get cursorValueRelativeDate() {
    const matchedTokens = [Token.ValueRelativeDate] as const;
    return this.findTokensAtCursor(matchedTokens);
  }

  get currentFieldDefinition() {
    if (!this.cursorToken || this.cursorToken.type !== Token.Filter) {
      return null;
    }

    const tagName = getKeyName(this.cursorToken.key, {aggregateWithArgs: true});

    return this.props.fieldDefinitionGetter(tagName);
  }

  /**
   * Determines when the date picker should be shown instead of normal dropdown options.
   * This should return true when the cursor is within a date tag value and the user has
   * typed in an operator (or already has a date value).
   */
  get shouldShowDatePicker() {
    if (
      !this.state.showDropdown ||
      !this.cursorToken ||
      this.currentFieldDefinition?.valueType !== FieldValueType.DATE ||
      this.cursorValueRelativeDate ||
      !(
        this.cursorToken.type === Token.Filter &&
        isWithinToken(this.cursorToken.value, this.cursorPosition)
      )
    ) {
      return false;
    }

    const textValue = this.cursorFilter?.value?.text ?? '';

    if (
      // Cursor is in a valid ISO date value
      this.cursorValueIsoDate ||
      // Cursor is in a value that has an operator
      this.cursorFilter?.operator ||
      // Cursor is in raw text value that matches one of the non-empty operators
      (textValue && isOperator(textValue))
    ) {
      return true;
    }

    return false;
  }

  get shouldShowAutocomplete() {
    return this.state.showDropdown && !this.shouldShowDatePicker;
  }

  /**
   * Get the current cursor position within the input
   */
  get cursorPosition() {
    if (!this.searchInput.current) {
      return -1;
    }

    return this.searchInput.current.selectionStart ?? -1;
  }

  /**
   * Get the search term at the current cursor position
   */
  get cursorSearchTerm() {
    const cursorPosition = this.cursorPosition;
    const cursorToken = this.cursorToken;

    if (!cursorToken) {
      return null;
    }

    const LIMITER_CHARS = [' ', ':'];

    const innerStart = cursorPosition - cursorToken.location.start.offset;

    let tokenStart = innerStart;
    while (tokenStart > 0 && !LIMITER_CHARS.includes(cursorToken.text[tokenStart - 1])) {
      tokenStart--;
    }
    let tokenEnd = innerStart;
    while (
      tokenEnd < cursorToken.text.length &&
      !LIMITER_CHARS.includes(cursorToken.text[tokenEnd])
    ) {
      tokenEnd++;
    }

    let searchTerm = cursorToken.text.slice(tokenStart, tokenEnd);

    if (searchTerm.startsWith(NEGATION_OPERATOR)) {
      tokenStart++;
    }
    searchTerm = searchTerm.replace(new RegExp(`^${NEGATION_OPERATOR}`), '');

    return {
      end: cursorToken.location.start.offset + tokenEnd,
      searchTerm,
      start: cursorToken.location.start.offset + tokenStart,
    };
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
  getTagKeys(searchTerm: string): [SearchItem[], ItemType] {
    const {
      excludedTags,
      fieldDefinitionGetter,
      organization,
      prepareQuery,
      supportedTags = {},
      supportedTagType,
    } = this.props;

    let tagKeys = Object.keys(supportedTags).sort((a, b) => a.localeCompare(b));

    if (searchTerm) {
      const preparedSearchTerm = prepareQuery ? prepareQuery(searchTerm) : searchTerm;

      tagKeys = filterKeysFromQuery(tagKeys, preparedSearchTerm, fieldDefinitionGetter);
    }

    // removes any tags that are marked for exclusion
    if (excludedTags) {
      tagKeys = tagKeys.filter(key => !excludedTags?.includes(key));
    }

    const allTagItems = getTagItemsFromKeys(
      tagKeys,
      supportedTags,
      fieldDefinitionGetter
    );

    // Filter out search items that are behind feature flags
    const tagItems = allTagItems.filter(
      item =>
        item.featureFlag === undefined || organization.features.includes(item.featureFlag)
    );

    return [tagItems, supportedTagType ?? ItemType.TAG_KEY];
  }

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getTagValues = debounce(
    async (tag: Tag, query: string): Promise<SearchItem[]> => {
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
    } catch {
      return [];
    }
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
    const [tagKeys, tagType] = this.getTagKeys(tagName);
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
    const {prepareQuery, excludedTags, organization, savedSearchType, searchSource} =
      this.props;
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
      trackAdvancedAnalyticsEvent('search.invalid_field', {
        organization,
        search_type: savedSearchType === 0 ? 'issues' : 'events',
        search_source: searchSource,
        attempted_field_name: tagName,
      });

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

    if (excludedTags && excludedTags.includes(tagName)) {
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

    // Always clear searchTerm on showing default state.
    this.setState({searchTerm: ''});

    if (!defaultSearchItems.length) {
      // Update searchTerm, otherwise <SearchDropdown> will have wrong state
      // (e.g. if you delete a query, the last letter will be highlighted if `searchTerm`
      // does not get updated)

      const [tagKeys, tagType] = this.getTagKeys('');
      const recentSearches = await this.getRecentSearches();

      if (this.state.query === query) {
        this.updateAutoCompleteState(tagKeys, recentSearches ?? [], '', tagType);
      }

      return;
    }

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

        const fieldDefinition = this.props.fieldDefinitionGetter(tagName);
        const isDate = fieldDefinition?.valueType === FieldValueType.DATE;

        if (isDate) {
          const groups = getDateTagAutocompleteGroups(tagName);

          this.updateAutoCompleteStateMultiHeader(groups);

          return;
        }

        const valueGroup = await this.generateValueAutocompleteGroup(tagName, searchText);
        const autocompleteGroups = valueGroup ? [valueGroup] : [];
        // show operator group if at beginning of value
        if (cursor === node.location.start.offset) {
          const opGroup = generateOpAutocompleteGroup(getValidOps(cursorToken), tagName);
          if (valueGroup?.type !== ItemType.INVALID_TAG && !isDate) {
            autocompleteGroups.unshift(opGroup);
          }
        }

        if (cursor === this.cursorPosition) {
          this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
        }

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

        if (cursor === this.cursorPosition) {
          this.setState({
            searchTerm: tagName,
          });

          this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
        }
        return;
      }

      // show operator autocomplete group
      const opGroup = generateOpAutocompleteGroup(getValidOps(cursorToken), tagName);
      this.updateAutoCompleteStateMultiHeader([opGroup]);
      return;
    }

    const cursorSearchTerm = this.cursorSearchTerm;
    if (cursorToken.type === Token.FreeText && cursorSearchTerm) {
      const autocompleteGroups = [
        await this.generateTagAutocompleteGroup(cursorSearchTerm.searchTerm),
      ];

      if (cursor === this.cursorPosition) {
        this.setState({
          searchTerm: cursorSearchTerm.searchTerm,
        });
        this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
      }
      return;
    }
  };

  updateAutoCompleteItems = () => {
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
    const {fieldDefinitionGetter, hasRecentSearches, maxSearchItems, maxQueryLength} =
      this.props;
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
      true,
      fieldDefinitionGetter
    );

    this.setState(searchGroups);
  }

  /**
   * Updates autocomplete dropdown items and autocomplete index state
   *
   * @param groups Groups that will be used to populate the autocomplete dropdown
   */
  updateAutoCompleteStateMultiHeader = (groups: AutocompleteGroup[]) => {
    const {fieldDefinitionGetter, hasRecentSearches, maxSearchItems, maxQueryLength} =
      this.props;
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
          false,
          fieldDefinitionGetter
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
    this.setState(this.makeQueryState(newQuery), () => {
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
            // For ISO date values, we want to keep the cursor within the token
          } else if (item.type !== ItemType.TAG_VALUE_ISO_DATE) {
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

    const cursorSearchTerm = this.cursorSearchTerm;
    if (cursorToken.type === Token.FreeText && cursorSearchTerm) {
      clauseStart = cursorSearchTerm.start;
      clauseEnd = cursorSearchTerm.end;
    }

    if (clauseStart !== null && clauseEnd !== null) {
      const beforeClause = query.substring(0, clauseStart);
      const endClause = query.substring(clauseEnd);
      // Adds a space between the replaceToken and endClause when necessary
      const replaceTokenEndClauseJoiner =
        !endClause ||
        endClause.startsWith(' ') ||
        replaceToken.endsWith(' ') ||
        replaceToken.endsWith(':')
          ? ''
          : ' ';
      const newQuery = `${beforeClause}${replaceToken}${replaceTokenEndClauseJoiner}${endClause}`;
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

      this.setState(this.makeQueryState(replaceText), () => {
        // Propagate onSearch and save to recent searches
        this.doSearch();
      });

      return;
    }

    this.onAutoCompleteFromAst(replaceText, item);
  };

  onAutoCompleteIsoDate = (isoDate: string) => {
    const dateItem = {type: ItemType.TAG_VALUE_ISO_DATE};

    if (
      this.cursorFilter?.filter === FilterType.Date ||
      this.cursorFilter?.filter === FilterType.SpecificDate
    ) {
      this.onAutoCompleteFromAst(`${this.cursorFilter.operator}${isoDate}`, dateItem);
    } else if (this.cursorFilter?.filter === FilterType.Text) {
      const valueText = this.cursorFilter.value.text;

      if (valueText && isOperator(valueText)) {
        this.onAutoCompleteFromAst(`${valueText}${isoDate}`, dateItem);
      }
    }
  };

  get showSearchDropdown(): boolean {
    return this.state.loading || this.state.searchGroups.length > 0;
  }

  render() {
    const {
      api,
      className,
      id,
      savedSearchType,
      dropdownClassName,
      actionBarItems,
      organization,
      placeholder,
      disabled,
      useFormWrapper,
      includeLabel,
      inlineLabel,
      maxQueryLength,
      maxMenuHeight,
      name,
      customPerformanceMetrics,
      supportedTags,
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
        id={id}
        data-test-id="smart-search-input"
        name={name}
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
      .map(({key, makeAction}) => {
        const ActionBarButton = makeAction(actionProps).Button;
        return <ActionBarButton key={key} />;
      });

    const overflowedActions = actionItems
      .slice(numActionsVisible)
      .map(({makeAction}) => makeAction(actionProps).menuItem);

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
        data-test-id="smart-search-bar"
      >
        <SearchHotkeysListener
          visibleShortcuts={visibleShortcuts}
          runShortcut={this.runShortcutOnHotkeyPress}
        />
        {includeLabel ? (
          <SearchLabel htmlFor={id} aria-label={t('Search events')}>
            <IconSearch />
            {inlineLabel}
          </SearchLabel>
        ) : (
          <SearchIconContainer>
            <IconSearch />
          </SearchIconContainer>
        )}

        <InputWrapper>
          <Highlight>
            {parsedQuery !== null ? (
              <HighlightQuery
                parsedQuery={parsedQuery}
                cursorPosition={this.state.showDropdown ? cursor : -1}
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
            <OverlowingActionsMenu
              position="bottom-end"
              trigger={props => (
                <ActionButton
                  {...props}
                  aria-label={t('Show more')}
                  icon={<VerticalEllipsisIcon size="xs" />}
                />
              )}
              triggerLabel={t('Show more')}
              items={overflowedActions}
              size="sm"
            />
          )}
        </ActionsBar>

        {this.shouldShowDatePicker && (
          <SearchBarDatePicker
            date={this.cursorValueIsoDate?.value}
            dateString={this.cursorValueIsoDate?.text}
            handleSelectDateTime={value => {
              this.onAutoCompleteIsoDate(value);
            }}
          />
        )}

        {this.shouldShowAutocomplete && (
          <SearchDropdown
            className={dropdownClassName}
            items={searchGroups}
            onClick={this.onAutoComplete}
            loading={loading}
            searchSubstring={searchTerm}
            runShortcut={this.runShortcutOnClick}
            visibleShortcuts={visibleShortcuts}
            maxMenuHeight={maxMenuHeight}
            customPerformanceMetrics={customPerformanceMetrics}
            supportedTags={supportedTags}
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

export default withApi(withSentryRouter(withOrganization(SmartSearchBarContainer)));

export {SmartSearchBar, Props as SmartSearchBarProps};

const Container = styled('div')<{inputHasFocus: boolean}>`
  min-height: ${p => p.theme.form.md.height}px;
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset ${p => p.theme.dropShadowMedium};
  background: ${p => p.theme.background};
  padding: 6px ${space(1)};
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

const SearchIconContainer = styled('div')`
  display: flex;
  padding: ${space(0.5)} 0;
  margin: 0;
  color: ${p => p.theme.gray300};
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
  height: 100%;
`;

const VerticalEllipsisIcon = styled(IconEllipsis)`
  transform: rotate(90deg);
`;

const OverlowingActionsMenu = styled(DropdownMenu)`
  display: flex;
`;
