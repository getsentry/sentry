import * as React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import {withRouter, WithRouterProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {fetchRecentSearches, saveRecentSearch} from 'app/actionCreators/savedSearches';
import {Client} from 'app/api';
import ButtonBar from 'app/components/buttonBar';
import DropdownLink from 'app/components/dropdownLink';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {
  ParseResult,
  parseSearch,
  TermOperator,
  Token,
  TokenResult,
} from 'app/components/searchSyntax/parser';
import HighlightQuery from 'app/components/searchSyntax/renderer';
import {
  getKeyName,
  isWithinToken,
  treeResultLocator,
} from 'app/components/searchSyntax/utils';
import {
  DEFAULT_DEBOUNCE_DURATION,
  MAX_AUTOCOMPLETE_RELEASES,
  NEGATION_OPERATOR,
} from 'app/constants';
import {IconClose, IconEllipsis, IconSearch} from 'app/icons';
import {t} from 'app/locale';
import MemberListStore from 'app/stores/memberListStore';
import space from 'app/styles/space';
import {LightWeightOrganization, SavedSearchType, Tag, User} from 'app/types';
import {defined} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {callIfFunction} from 'app/utils/callIfFunction';
import withApi from 'app/utils/withApi';
import withExperiment from 'app/utils/withExperiment';
import withOrganization from 'app/utils/withOrganization';

import {ActionButton} from './actions';
import SearchDropdown from './searchDropdown';
import {ItemType, SearchGroup, SearchItem} from './types';
import {
  addSpace,
  createSearchGroups,
  filterSearchGroupsByIndex,
  generateOperatorEntryMap,
  getLastTermIndex,
  getQueryTerms,
  getValidOps,
  removeSpace,
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

type ActionProps = {
  api: Client;
  /**
   * Render the actions as a menu item
   */
  menuItemVariant?: boolean;
  /**
   * The current query
   */
  query: string;
  /**
   * The organization
   */
  organization: LightWeightOrganization;
  /**
   * The saved search type passed to the search bar
   */
  savedSearchType?: SavedSearchType;
};

type ActionBarItem = {
  /**
   * Name of the action
   */
  key: string;
  /**
   * The action component to render
   */
  Action: React.ComponentType<ActionProps>;
};

type AutocompleteGroup = {
  searchItems: SearchItem[];
  recentSearchItems: SearchItem[] | undefined;
  tagName: string;
  type: ItemType;
};

type Props = WithRouterProps & {
  api: Client;
  organization: LightWeightOrganization;
  dropdownClassName?: string;
  className?: string;

  defaultQuery?: string;
  query?: string | null;
  /**
   * Additional components to render as actions on the right of the search bar
   */
  actionBarItems?: ActionBarItem[];
  /**
   * Prepare query value before filtering dropdown items
   */
  prepareQuery?: (query: string) => string;
  /**
   * Search items to display when there's no tag key. Is a tuple of search
   * items and recent search items
   */
  defaultSearchItems?: [SearchItem[], SearchItem[]];
  /**
   * Disabled control (e.g. read-only)
   */
  disabled?: boolean;
  /**
   * Input placeholder
   */
  placeholder?: string;
  /**
   * Allows additional content to be played before the search bar and icon
   */
  inlineLabel?: React.ReactNode;
  /**
   * Map of tags
   */
  supportedTags?: {[key: string]: Tag};
  /**
   * Maximum number of search items to display or a falsey value for no
   * maximum
   */
  maxSearchItems?: number;
  /**
   * List user's recent searches
   */
  hasRecentSearches?: boolean;
  /**
   * Wrap the input with a form. Useful if search bar is used within a parent
   * form
   */
  useFormWrapper?: boolean;
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
   * Get a list of tag values for the passed tag
   */
  onGetTagValues?: (tag: Tag, query: string, params: object) => Promise<string[]>;
  /**
   * Get a list of recent searches for the current query
   */
  onGetRecentSearches?: (query: string) => Promise<SearchItem[]>;
  /**
   * Called when the user makes a search
   */
  onSearch?: (query: string) => void;
  /**
   * Called when the search input changes
   */
  onChange?: (value: string, e: React.ChangeEvent) => void;
  /**
   * Called when the search is blurred
   */
  onBlur?: (value: string) => void;
  /**
   * Called on key down
   */
  onKeyDown?: (evt: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /**
   * Called when a recent search is saved
   */
  onSavedRecentSearch?: (query: string) => void;
  /**
   * If true, excludes the environment tag from the autocompletion list. This
   * is because we don't want to treat environment as a tag in some places such
   * as the stream view where it is a top level concept
   */
  excludeEnvironment?: boolean;
  /**
   * Used to enforce length on the query
   */
  maxQueryLength?: number;
  /**
   * While the data is unused, this list of members can be updated to
   * trigger re-renders.
   */
  members?: User[];
  /**
   * Tracks whether the experiment for improved search is active or not
   */
  experimentAssignment: 0 | 1;
};

type State = {
  /**
   * The current search query in the input
   */
  query: string;
  /**
   * The query parsed into an AST. If the query fails to parse this will be
   * null.
   */
  parsedQuery: ParseResult | null;
  /**
   * The query in the input since we last updated our autocomplete list.
   */
  previousQuery?: string;
  /**
   * Indicates that we have a query that we've already determined not to have
   * any values. This is used to stop the autocompleter from querying if we
   * know we will find nothing.
   */
  noValueQuery?: string;
  /**
   * The current search term (or 'key') that that we will be showing
   * autocompletion for.
   */
  searchTerm: string;
  searchGroups: SearchGroup[];
  flatSearchItems: SearchItem[];
  /**
   * Index of the focused search item
   */
  activeSearchItem: number;
  tags: Record<string, string>;
  inputHasFocus: boolean;
  loading: boolean;
  /**
   * The number of actions that are not in the overflow menu.
   */
  numActionsVisible: number;
};

class SmartSearchBar extends React.Component<Props, State> {
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

    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
  }

  get hasImprovedSearch() {
    return (
      this.props.organization.features.includes('improved-search') ||
      !!this.props.experimentAssignment
    );
  }

  get initialQuery() {
    const {query, defaultQuery} = this.props;
    return query !== null ? addSpace(query) : defaultQuery ?? '';
  }

  /**
   * Tracks the dropdown blur
   */
  blurTimeout?: number;

  /**
   * Ref to the search element itself
   */
  searchInput = React.createRef<HTMLTextAreaElement>();

  /**
   * Ref to the search container
   */
  containerRef = React.createRef<HTMLDivElement>();

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

    if (this.hasImprovedSearch && !this.hasValidSearch) {
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

    trackAnalyticsEvent({
      eventKey: 'search.searched',
      eventName: 'Search: Performed search',
      organization_id: organization.id,
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
    const value = e.target.value;
    const blurHandler = () => {
      this.blurTimeout = undefined;
      this.setState({inputHasFocus: false});
      callIfFunction(this.props.onBlur, value);
    };

    this.blurTimeout = window.setTimeout(blurHandler, DROPDOWN_BLUR_DURATION);
  };

  onQueryChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    const query = evt.target.value.replace('\n', '');

    this.setState(makeQueryState(query), this.updateAutoCompleteItems);
    callIfFunction(this.props.onChange, evt.target.value, evt);
  };

  onInputClick = () => this.updateAutoCompleteItems();

  /**
   * Handle keyboard navigation
   */
  onKeyDown = (evt: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const {onKeyDown} = this.props;
    const {key} = evt;

    callIfFunction(onKeyDown, evt);

    if (!this.state.searchGroups.length) {
      return;
    }

    const isSelectingDropdownItems = this.state.activeSearchItem !== -1;

    if (key === 'ArrowDown' || key === 'ArrowUp') {
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

    if ((key === 'Tab' || key === 'Enter') && isSelectingDropdownItems) {
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
        this.onAutoComplete(item.value, item);
      }
      return;
    }

    if (key === 'Enter' && !isSelectingDropdownItems) {
      this.doSearch();
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
    const {parsedQuery} = this.state;

    if (parsedQuery === null) {
      return null;
    }

    const matchedTokens = [Token.Filter, Token.FreeText];
    const cursor = this.cursorPosition;

    return treeResultLocator<TokenResult<Token.Filter | Token.FreeText> | null>({
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

  /**
   * Returns array of possible key values that substring match `query`
   */
  getTagKeys(query: string): SearchItem[] {
    const {prepareQuery} = this.props;

    const supportedTags = this.props.supportedTags ?? {};

    // Return all if query is empty
    let tagKeys = Object.keys(supportedTags).map(key => `${key}:`);

    if (query) {
      const preparedQuery =
        typeof prepareQuery === 'function' ? prepareQuery(query) : query;
      tagKeys = tagKeys.filter(key => key.indexOf(preparedQuery) > -1);
    }

    // If the environment feature is active and excludeEnvironment = true
    // then remove the environment key
    if (this.props.excludeEnvironment) {
      tagKeys = tagKeys.filter(key => key !== 'environment:');
    }

    return tagKeys.map(value => ({value, desc: value}));
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
      const endpointParams = getParams(location.query);

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
        // Wrap in quotes if there is a space
        const escapedValue =
          value.includes(' ') || value.includes('"')
            ? `"${value.replace(/"/g, '\\"')}"`
            : value;

        return {value: escapedValue, desc: escapedValue, type: ItemType.TAG_VALUE};
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
      .map((value, i) => ({
        value,
        desc: value,
        type: ItemType.TAG_VALUE,
        ignoreMaxSearchItems: tag.maxSuggestedValues ? i < tag.maxSuggestedValues : false,
      }));

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
    const tagKeys = this.getTagKeys(tagName);
    const recentSearches = await this.getRecentSearches();

    return {
      searchItems: tagKeys,
      recentSearchItems: recentSearches ?? [],
      tagName,
      type: ItemType.TAG_KEY,
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
        searchItems: [],
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

      const tagKeys = this.getTagKeys('');
      const recentSearches = await this.getRecentSearches();

      this.updateAutoCompleteState(tagKeys, recentSearches ?? [], '', ItemType.TAG_KEY);
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

        const valueGroup = await this.generateValueAutocompleteGroup(tagName, node.text);
        const autocompleteGroups = valueGroup ? [valueGroup] : [];
        // show operator group if at beginning of value
        if (cursor === node.location.start.offset) {
          const opGroup = generateOpAutocompleteGroup(getValidOps(cursorToken), tagName);
          autocompleteGroups.unshift(opGroup);
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

  updateAutoCompleteItems = async () => {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = undefined;
    }

    const cursor = this.cursorPosition;

    if (this.hasImprovedSearch) {
      this.updateAutoCompleteFromAst();
      return;
    }

    let {query} = this.state;

    // Don't continue if the query hasn't changed
    if (query === this.state.previousQuery) {
      return;
    }

    this.setState({previousQuery: query});

    const lastTermIndex = getLastTermIndex(query, cursor);
    const terms = getQueryTerms(query, lastTermIndex);

    if (
      !terms || // no terms
      terms.length === 0 || // no terms
      (terms.length === 1 && terms[0] === this.props.defaultQuery) || // default term
      /^\s+$/.test(query.slice(cursor - 1, cursor + 1))
    ) {
      this.showDefaultSearches();
      return;
    }

    const last = terms.pop() ?? '';

    let autoCompleteItems: SearchItem[];
    let matchValue: string;
    let tagName: string;
    const index = last.indexOf(':');

    if (index === -1) {
      // No colon present; must still be deciding key
      matchValue = last.replace(new RegExp(`^${NEGATION_OPERATOR}`), '');

      autoCompleteItems = this.getTagKeys(matchValue);
      const recentSearches = await this.getRecentSearches();

      this.setState({searchTerm: matchValue});
      this.updateAutoCompleteState(
        autoCompleteItems,
        recentSearches ?? [],
        matchValue,
        ItemType.TAG_KEY
      );
      return;
    }

    // TODO(billy): Better parsing for these examples
    //
    // > sentry:release:
    // > url:"http://with/colon"
    tagName = last.slice(0, index);

    // e.g. given "!gpu" we want "gpu"
    tagName = tagName.replace(new RegExp(`^${NEGATION_OPERATOR}`), '');
    query = last.slice(index + 1);
    const valueGroup = await this.generateValueAutocompleteGroup(tagName, query);
    if (valueGroup) {
      this.updateAutoCompleteState(
        valueGroup.searchItems ?? [],
        valueGroup.recentSearchItems ?? [],
        valueGroup.tagName,
        valueGroup.type
      );
      return;
    }
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

    this.setState(
      createSearchGroups(
        searchItems,
        hasRecentSearches ? recentSearchItems : undefined,
        tagName,
        type,
        maxSearchItems,
        queryCharsLeft
      )
    );
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
          queryCharsLeft
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
        trackAnalyticsEvent({
          eventKey: 'search.operator_autocompleted',
          eventName: 'Search: Operator Autocompleted',
          organization_id: this.props.organization.id,
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
        const location = cursorToken.value.location;
        const keyLocation = cursorToken.key.location;
        // Include everything after the ':'
        clauseStart = keyLocation.end.offset + 1;
        clauseEnd = location.end.offset + 1;
        replaceToken += ' ';
      } else if (isWithinToken(cursorToken.key, cursor)) {
        const location = cursorToken.key.location;
        clauseStart = location.start.offset;
        // If the token is a key, then trim off the end to avoid duplicate ':'
        clauseEnd = location.end.offset + 1;
      }
    }

    if (cursorToken.type === Token.FreeText) {
      clauseStart = cursorToken.location.start.offset;
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
      trackAnalyticsEvent({
        eventKey: 'search.searched',
        eventName: 'Search: Performed search',
        organization_id: this.props.organization.id,
        query: replaceText,
        source: this.props.savedSearchType === 0 ? 'issues' : 'events',
        search_source: 'recent_search',
      });

      this.setState(makeQueryState(replaceText), () => {
        // Propagate onSearch and save to recent searches
        this.doSearch();
      });

      return;
    }

    const cursor = this.cursorPosition;
    const {query} = this.state;

    if (this.hasImprovedSearch) {
      this.onAutoCompleteFromAst(replaceText, item);
      return;
    }

    const lastTermIndex = getLastTermIndex(query, cursor);
    const terms = getQueryTerms(query, lastTermIndex);
    let newQuery: string;

    // If not postfixed with : (tag value), add trailing space
    replaceText += item.type !== ItemType.TAG_VALUE || cursor < query.length ? '' : ' ';

    const isNewTerm =
      query.charAt(query.length - 1) === ' ' && item.type !== ItemType.TAG_VALUE;

    if (!terms) {
      newQuery = replaceText;
    } else if (isNewTerm) {
      newQuery = `${query}${replaceText}`;
    } else {
      const last = terms.pop() ?? '';
      newQuery = query.slice(0, lastTermIndex); // get text preceding last term

      const prefix = last.startsWith(NEGATION_OPERATOR) ? NEGATION_OPERATOR : '';

      // newQuery is all the terms up to the current term: "... <term>:"
      // replaceText should be the selected value
      if (last.indexOf(':') > -1) {
        let replacement = `:${replaceText}`;

        // The user tag often contains : within its value and we need to quote it.
        if (last.startsWith('user:')) {
          const colonIndex = replaceText.indexOf(':');
          if (colonIndex > -1) {
            replacement = `:"${replaceText.trim()}"`;
          }
        }

        // tag key present: replace everything after colon with replaceText
        newQuery = newQuery.replace(/\:"[^"]*"?$|\:\S*$/, replacement);
      } else {
        // no tag key present: replace last token with replaceText
        newQuery = newQuery.replace(/\S+$/, `${prefix}${replaceText}`);
      }

      newQuery = newQuery.concat(query.slice(lastTermIndex));
    }

    this.updateQuery(newQuery);
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

    return (
      <Container ref={this.containerRef} className={className} isOpen={inputHasFocus}>
        <SearchLabel htmlFor="smart-search-input" aria-label={t('Search events')}>
          <IconSearch />
          {inlineLabel}
        </SearchLabel>

        <InputWrapper>
          <Highlight>
            {this.hasImprovedSearch && parsedQuery !== null ? (
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
          />
        )}
      </Container>
    );
  }
}

type ContainerState = {
  members: ReturnType<typeof MemberListStore.getAll>;
};

class SmartSearchBarContainer extends React.Component<Props, ContainerState> {
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

const SmartSearchBarContainerWithExperiment = withExperiment(SmartSearchBarContainer, {
  experiment: 'ImprovedSearchExperiment',
});

export default withApi(
  withRouter(withOrganization(SmartSearchBarContainerWithExperiment))
);

export {SmartSearchBar};

const Container = styled('div')<{isOpen: boolean}>`
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset ${p => p.theme.dropShadowLight};
  background: ${p => p.theme.background};
  padding: 7px ${space(1)};
  position: relative;
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-gap: ${space(1)};
  align-items: start;

  border-radius: ${p =>
    p.isOpen
      ? `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`
      : p.theme.borderRadius};

  .show-sidebar & {
    background: ${p => p.theme.backgroundSecondary};
  }
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

const SearchInput = styled(TextareaAutosize, {
  shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
})`
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
