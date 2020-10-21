import {ClassNames} from '@emotion/core';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import * as React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import debounce from 'lodash/debounce';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {callIfFunction} from 'app/utils/callIfFunction';
import {defined} from 'app/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import CreateSavedSearchButton from 'app/views/issueList/createSavedSearchButton';
import DropdownLink from 'app/components/dropdownLink';
import {IconEllipsis, IconSearch, IconSliders, IconClose, IconPin} from 'app/icons';
import MemberListStore from 'app/stores/memberListStore';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {Client} from 'app/api';
import {LightWeightOrganization, SavedSearch, Tag, SavedSearchType} from 'app/types';
import {
  fetchRecentSearches,
  pinSearch,
  saveRecentSearch,
  unpinSearch,
} from 'app/actionCreators/savedSearches';
import {
  DEFAULT_DEBOUNCE_DURATION,
  MAX_AUTOCOMPLETE_RELEASES,
  NEGATION_OPERATOR,
} from 'app/constants';

import SearchDropdown from './searchDropdown';
import {SearchItem, SearchGroup, ItemType} from './types';
import {
  addSpace,
  removeSpace,
  createSearchGroups,
  filterSearchGroupsByIndex,
} from './utils';

const DROPDOWN_BLUR_DURATION = 200;

const getMediaQuery = (size: string, type: React.CSSProperties['display']) => `
  display: ${type};

  @media (min-width: ${size}) {
    display: ${type === 'none' ? 'block' : 'none'};
  }
`;

const getInputButtonStyles = (p: {
  isActive?: boolean;
  collapseIntoEllipsisMenu?: number;
}) => `
  color: ${p.isActive ? theme.blue300 : theme.gray500};
  margin-left: ${space(0.5)};
  width: 18px;

  &,
  &:hover,
  &:focus {
    background: transparent;
  }

  &:hover {
    color: ${theme.gray600};
  }

  ${
    p.collapseIntoEllipsisMenu &&
    getMediaQuery(theme.breakpoints[p.collapseIntoEllipsisMenu], 'none')
  };
`;

const getDropdownElementStyles = (p: {showBelowMediaQuery: number; last?: boolean}) => `
  padding: 0 ${space(1)} ${p.last ? null : space(0.5)};
  margin-bottom: ${p.last ? null : space(0.5)};
  display: none;
  color: ${theme.gray700};
  align-items: center;
  min-width: 190px;
  height: 38px;
  padding-left: ${space(1.5)};
  padding-right: ${space(1.5)};

  &,
  &:hover,
  &:focus {
    border-bottom: ${p.last ? null : `1px solid ${theme.borderDark}`};
    border-radius: 0;
  }

  &:hover {
    color: ${theme.blue500};
  }
  & > svg {
    margin-right: ${space(1)};
  }

  ${
    p.showBelowMediaQuery &&
    getMediaQuery(theme.breakpoints[p.showBelowMediaQuery], 'flex')
  }
`;

type Props = {
  api: Client;
  organization: LightWeightOrganization;
  dropdownClassName?: string;
  className?: string;

  defaultQuery?: string;
  query?: string | null;
  /**
   * Prepare query value before filtering dropdown items
   */
  prepareQuery?: (query: string) => string;
  /**
   * Search items to display when there's no tag key. Is a tuple of search items and recent search items
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
   * Has search builder UI
   */
  hasSearchBuilder?: boolean;
  /**
   * Can create a saved search
   */
  canCreateSavedSearch?: boolean;
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
   * Has pinned search feature
   */
  hasPinnedSearch?: boolean;
  /**
   * The pinned search object
   */
  pinnedSearch?: SavedSearch;
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
  onKeyDown?: (evt: React.KeyboardEvent<HTMLInputElement>) => void;

  /**
   * Called when a recent search is saved
   */
  onSavedRecentSearch?: (query: string) => void;
  /**
   * Called when the sidebar is toggled
   */
  onSidebarToggle?: React.EventHandler<React.MouseEvent>;
  /**
   * If true, excludes the environment tag from the autocompletion list. This
   * is because we don't want to treat environment as a tag in some places
   * such as the stream view where it is a top level concept
   */
  excludeEnvironment?: boolean;
};

type State = {
  /**
   * The current search query in the input
   */
  query: string;
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
  tags: {[key: string]: string};
  dropdownVisible: boolean;
  loading: boolean;
};

class SmartSearchBar extends React.Component<Props, State> {
  /**
   * Given a query, and the current cursor position, return the string-delimiting
   * index of the search term designated by the cursor.
   */
  static getLastTermIndex = (query: string, cursor: number) => {
    // TODO: work with quoted-terms
    const cursorOffset = query.slice(cursor).search(/\s|$/);
    return cursor + (cursorOffset === -1 ? 0 : cursorOffset);
  };

  /**
   * Returns an array of query terms, including incomplete terms
   *
   * e.g. ["is:unassigned", "browser:\"Chrome 33.0\"", "assigned"]
   */
  static getQueryTerms = (query: string, cursor: number) =>
    query.slice(0, cursor).match(/\S+:"[^"]*"?|\S+/g);

  static contextTypes = {
    router: PropTypes.object,
  };

  static defaultProps = {
    defaultQuery: '',
    query: null,
    onSearch: function () {},
    excludeEnvironment: false,
    placeholder: t('Search for events, users, tags, and everything else.'),
    supportedTags: {},
    defaultSearchItems: [[], []],
    hasPinnedSearch: false,
    useFormWrapper: true,
    savedSearchType: SavedSearchType.ISSUE,
  };

  state: State = {
    query:
      this.props.query !== null
        ? addSpace(this.props.query)
        : this.props.defaultQuery ?? '',
    searchTerm: '',
    searchGroups: [],
    flatSearchItems: [],
    activeSearchItem: -1,
    tags: {},
    dropdownVisible: false,
    loading: false,
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    // query was updated by another source (e.g. sidebar filters)
    if (nextProps.query !== this.props.query) {
      this.setState({
        query: addSpace(nextProps.query),
      });
    }
  }

  componentWillUnmount() {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = undefined;
    }
  }

  /**
   * Tracks the dropdown blur
   */
  blurTimeout?: number;
  /**
   * Ref to the search element itself
   */
  searchInput = React.createRef<HTMLInputElement>();

  blur = () => {
    if (!this.searchInput.current) {
      return;
    }
    this.searchInput.current.blur();
  };

  onSubmit = (evt: React.FormEvent) => {
    const {organization, savedSearchType} = this.props;
    evt.preventDefault();

    trackAnalyticsEvent({
      eventKey: 'search.searched',
      eventName: 'Search: Performed search',
      organization_id: organization.id,
      query: removeSpace(this.state.query),
      search_type: savedSearchType === 0 ? 'issues' : 'events',
      search_source: 'main_search',
    });

    this.doSearch();
  };

  doSearch = async () => {
    const {
      onSearch,
      onSavedRecentSearch,
      api,
      organization,
      savedSearchType,
    } = this.props;
    this.blur();
    const query = removeSpace(this.state.query);
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
  };

  clearSearch = () =>
    this.setState({query: ''}, () =>
      callIfFunction(this.props.onSearch, this.state.query)
    );

  onQueryFocus = () => this.setState({dropdownVisible: true});

  onQueryBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // wait before closing dropdown in case blur was a result of clicking a
    // menu option
    const value = e.target.value;
    const blurHandler = () => {
      this.blurTimeout = undefined;
      this.setState({dropdownVisible: false});
      callIfFunction(this.props.onBlur, value);
    };

    this.blurTimeout = window.setTimeout(blurHandler, DROPDOWN_BLUR_DURATION);
  };

  onQueryChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({query: evt.target.value}, this.updateAutoCompleteItems);
    callIfFunction(this.props.onChange, evt.target.value, evt);
  };

  onInputClick = () => this.updateAutoCompleteItems();

  /**
   * Handle keyboard navigation
   */
  onKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    const {onKeyDown} = this.props;
    const {key} = evt;

    callIfFunction(onKeyDown, evt);

    if (!this.state.searchGroups.length) {
      return;
    }

    const {useFormWrapper} = this.props;
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

      if (item && !this.isDefaultDropdownItem(item)) {
        this.onAutoComplete(item.value, item);
      }
      return;
    }

    if (key === 'Enter') {
      if (!useFormWrapper && !isSelectingDropdownItems) {
        // If enter is pressed, and we are not wrapping input in a `<form>`,
        // and we are not selecting an item from the dropdown, then we should
        // consider the user as finished selecting and perform a "search" since
        // there is no `<form>` to catch and call `this.onSubmit`
        this.doSearch();
      }
      return;
    }
  };

  onKeyUp = (evt: React.KeyboardEvent<HTMLInputElement>) => {
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

  getCursorPosition = () => {
    if (!this.searchInput.current) {
      return -1;
    }
    return this.searchInput.current.selectionStart ?? -1;
  };

  /**
   * Returns array of possible key values that substring match `query`
   */
  getTagKeys = (query: string): SearchItem[] => {
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
  };

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

      const {location} = this.context.router;
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
      if (tag.key === 'release' && !values.includes('latest')) {
        values.push('latest');
      }

      const noValueQuery = values.length === 0 && query.length > 0 ? query : undefined;
      this.setState({noValueQuery});

      return values.map(value => {
        // Wrap in quotes if there is a space
        const escapedValue =
          value.includes(' ') || value.includes('"')
            ? `"${value.replace(/"/g, '\\"')}"`
            : value;

        return {value: escapedValue, desc: escapedValue, type: 'tag-value' as ItemType};
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
      .map(value => ({
        value,
        desc: value,
        type: 'tag-value',
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
        type: 'recent-search',
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
        type: 'first-release',
      }));

      const releases = await releasePromise;
      const releaseValues = releases.map<SearchItem>((r: any) => ({
        value: r.shortVersion,
        desc: r.shortVersion,
        type: 'first-release',
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
    const {api, organization} = this.props;
    const {location} = this.context.router;

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

  updateAutoCompleteItems = async () => {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = undefined;
    }

    const cursor = this.getCursorPosition();
    let query = this.state.query;

    // Don't continue if the query hasn't changed
    if (query === this.state.previousQuery) {
      return;
    }

    this.setState({previousQuery: query});

    const lastTermIndex = SmartSearchBar.getLastTermIndex(query, cursor);
    const terms = SmartSearchBar.getQueryTerms(query, lastTermIndex);

    if (
      !terms || // no terms
      terms.length === 0 || // no terms
      (terms.length === 1 && terms[0] === this.props.defaultQuery) || // default term
      /^\s+$/.test(query.slice(cursor - 1, cursor + 1))
    ) {
      const {
        defaultSearchItems: [defaultSearchItems, defaultRecentItems],
      } = this.props;

      if (!defaultSearchItems.length) {
        // Update searchTerm, otherwise <SearchDropdown> will have wrong state
        // (e.g. if you delete a query, the last letter will be highlighted if `searchTerm`
        // does not get updated)
        this.setState({searchTerm: query});

        const tagKeys = this.getTagKeys('');
        const recentSearches = await this.getRecentSearches();
        this.updateAutoCompleteState(tagKeys, recentSearches, '', 'tag-key');
        return;
      }

      // cursor on whitespace show default "help" search terms
      this.setState({searchTerm: ''});

      this.updateAutoCompleteState(defaultSearchItems, defaultRecentItems, '', 'default');
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
        recentSearches,
        matchValue,
        'tag-key'
      );
      return;
    }

    const {prepareQuery, excludeEnvironment} = this.props;
    const supportedTags = this.props.supportedTags ?? {};

    // TODO(billy): Better parsing for these examples
    //
    // > sentry:release:
    // > url:"http://with/colon"
    tagName = last.slice(0, index);

    // e.g. given "!gpu" we want "gpu"
    tagName = tagName.replace(new RegExp(`^${NEGATION_OPERATOR}`), '');
    query = last.slice(index + 1);
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
      this.updateAutoCompleteState([], [], tagName, 'invalid-tag');
      return;
    }

    // Ignore the environment tag if the feature is active and
    // excludeEnvironment = true
    if (excludeEnvironment && tagName === 'environment') {
      return;
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

    this.updateAutoCompleteState(tagValues, recentSearches, tag.key, 'tag-value');
    return;
  };

  isDefaultDropdownItem = (item: SearchItem) => item && item.type === 'default';

  /**
   * Updates autocomplete dropdown items and autocomplete index state
   *
   * @param searchItems List of search item objects with keys: title, desc, value
   * @param recentSearchItems List of recent search items, same format as searchItem
   * @param tagName The current tag name in scope
   * @param type Defines the type/state of the dropdown menu items
   */
  updateAutoCompleteState = (
    searchItems: SearchItem[],
    recentSearchItems: SearchItem[],
    tagName: string,
    type: ItemType
  ) => {
    const {hasRecentSearches, maxSearchItems} = this.props;

    this.setState(
      createSearchGroups(
        searchItems,
        hasRecentSearches ? recentSearchItems : undefined,
        tagName,
        type,
        maxSearchItems
      )
    );
  };

  onTogglePinnedSearch = async (evt: React.MouseEvent) => {
    const {
      api,
      organization,
      savedSearchType,
      hasPinnedSearch,
      pinnedSearch,
    } = this.props;

    const {router} = this.context;

    evt.preventDefault();
    evt.stopPropagation();

    if (savedSearchType === undefined || !hasPinnedSearch) {
      return;
    }

    // eslint-disable-next-line no-unused-vars
    const {cursor: _cursor, page: _page, ...currentQuery} = router.location.query;

    trackAnalyticsEvent({
      eventKey: 'search.pin',
      eventName: 'Search: Pin',
      organization_id: organization.id,
      action: !!pinnedSearch ? 'unpin' : 'pin',
      search_type: savedSearchType === 0 ? 'issues' : 'events',
      query: pinnedSearch?.query ?? this.state.query,
    });

    if (!!pinnedSearch) {
      unpinSearch(api, organization.slug, savedSearchType, pinnedSearch).then(() => {
        browserHistory.push({
          ...router.location,
          pathname: `/organizations/${organization.slug}/issues/`,
          query: {
            ...currentQuery,
            query: pinnedSearch.query,
          },
        });
      });
      return;
    }

    const resp = await pinSearch(
      api,
      organization.slug,
      savedSearchType,
      removeSpace(this.state.query)
    );

    if (!resp || !resp.id) {
      return;
    }

    browserHistory.push({
      ...router.location,
      pathname: `/organizations/${organization.slug}/issues/searches/${resp.id}/`,
      query: currentQuery,
    });
  };

  onAutoComplete = (replaceText: string, item: SearchItem) => {
    if (item.type === 'recent-search') {
      trackAnalyticsEvent({
        eventKey: 'search.searched',
        eventName: 'Search: Performed search',
        organization_id: this.props.organization.id,
        query: replaceText,
        source: this.props.savedSearchType === 0 ? 'issues' : 'events',
        search_source: 'recent_search',
      });

      this.setState({query: replaceText}, () => {
        // Propagate onSearch and save to recent searches
        this.doSearch();
      });

      return;
    }

    const cursor = this.getCursorPosition();
    const query = this.state.query;

    const lastTermIndex = SmartSearchBar.getLastTermIndex(query, cursor);
    const terms = SmartSearchBar.getQueryTerms(query, lastTermIndex);
    let newQuery: string;

    // If not postfixed with : (tag value), add trailing space
    replaceText += item.type !== 'tag-value' || cursor < query.length ? '' : ' ';

    const isNewTerm = query.charAt(query.length - 1) === ' ' && item.type !== 'tag-value';

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

    this.setState({query: newQuery}, () => {
      // setting a new input value will lose focus; restore it
      if (this.searchInput.current) {
        this.searchInput.current.focus();
      }

      // then update the autocomplete box with new contextTypes
      this.updateAutoCompleteItems();
    });
  };

  render() {
    const {
      className,
      dropdownClassName,
      organization,
      hasPinnedSearch,
      hasSearchBuilder,
      canCreateSavedSearch,
      pinnedSearch,
      placeholder,
      disabled,
      useFormWrapper,
      onSidebarToggle,
      inlineLabel,
    } = this.props;

    const pinTooltip = !!pinnedSearch ? t('Unpin this search') : t('Pin this search');
    const pinIcon = !!pinnedSearch ? (
      <IconPin isSolid size="xs" />
    ) : (
      <IconPin size="xs" />
    );
    const hasQuery = !!this.state.query;

    const input = (
      <React.Fragment>
        <StyledInput
          type="text"
          placeholder={placeholder}
          id="smart-search-input"
          name="query"
          ref={this.searchInput}
          autoComplete="off"
          value={this.state.query}
          onFocus={this.onQueryFocus}
          onBlur={this.onQueryBlur}
          onKeyUp={this.onKeyUp}
          onKeyDown={this.onKeyDown}
          onChange={this.onQueryChange}
          onClick={this.onInputClick}
          disabled={disabled}
        />
        {(this.state.loading || this.state.searchGroups.length > 0) && (
          <DropdownWrapper visible={this.state.dropdownVisible}>
            <SearchDropdown
              className={dropdownClassName}
              items={this.state.searchGroups}
              onClick={this.onAutoComplete}
              loading={this.state.loading}
              searchSubstring={this.state.searchTerm}
            />
          </DropdownWrapper>
        )}
      </React.Fragment>
    );

    return (
      <Container className={className} isOpen={this.state.dropdownVisible}>
        <SearchLabel htmlFor="smart-search-input" aria-label={t('Search events')}>
          <IconSearch />
          {inlineLabel}
        </SearchLabel>

        {useFormWrapper ? (
          <StyledForm onSubmit={this.onSubmit}>{input}</StyledForm>
        ) : (
          input
        )}
        <StyledButtonBar>
          {this.state.query !== '' && (
            <InputButton
              type="button"
              title={t('Clear search')}
              borderless
              aria-label="Clear search"
              size="zero"
              tooltipProps={{
                containerDisplayMode: 'inline-flex',
              }}
              onClick={this.clearSearch}
            >
              <IconClose size="xs" />
            </InputButton>
          )}
          {hasPinnedSearch && (
            <InputButton
              type="button"
              title={pinTooltip}
              borderless
              disabled={!hasQuery}
              aria-label={pinTooltip}
              size="zero"
              tooltipProps={{
                containerDisplayMode: 'inline-flex',
              }}
              onClick={this.onTogglePinnedSearch}
              collapseIntoEllipsisMenu={1}
              isActive={!!pinnedSearch}
              icon={pinIcon}
            />
          )}
          {canCreateSavedSearch && (
            <ClassNames>
              {({css}) => (
                <CreateSavedSearchButton
                  query={this.state.query}
                  organization={organization}
                  withTooltip
                  iconOnly
                  buttonClassName={css`
                    ${getInputButtonStyles({
                      collapseIntoEllipsisMenu: 2,
                    })}
                  `}
                />
              )}
            </ClassNames>
          )}
          {hasSearchBuilder && (
            <SearchBuilderButton
              title={t('Toggle search builder')}
              borderless
              size="zero"
              tooltipProps={{
                containerDisplayMode: 'inline-flex',
              }}
              collapseIntoEllipsisMenu={2}
              aria-label={t('Toggle search builder')}
              onClick={onSidebarToggle}
              icon={<IconSliders size="xs" />}
            />
          )}

          {(hasPinnedSearch || canCreateSavedSearch || hasSearchBuilder) && (
            <StyledDropdownLink
              anchorRight
              caret={false}
              title={
                <EllipsisButton
                  size="zero"
                  borderless
                  tooltipProps={{
                    containerDisplayMode: 'flex',
                  }}
                  type="button"
                  aria-label={t('Show more')}
                  icon={<VerticalEllipsisIcon size="xs" />}
                />
              }
            >
              {hasPinnedSearch && (
                <DropdownElement
                  showBelowMediaQuery={1}
                  data-test-id="pin-icon"
                  onClick={this.onTogglePinnedSearch}
                >
                  {pinIcon}
                  {!!pinnedSearch ? t('Unpin Search') : t('Pin Search')}
                </DropdownElement>
              )}
              {canCreateSavedSearch && (
                <ClassNames>
                  {({css}) => (
                    <CreateSavedSearchButton
                      query={this.state.query}
                      organization={organization}
                      buttonClassName={css`
                        ${getDropdownElementStyles({
                          showBelowMediaQuery: 2,
                          last: false,
                        })}
                      `}
                    />
                  )}
                </ClassNames>
              )}
              {hasSearchBuilder && (
                <DropdownElement showBelowMediaQuery={2} last onClick={onSidebarToggle}>
                  <IconSliders size="xs" />
                  {t('Toggle sidebar')}
                </DropdownElement>
              )}
            </StyledDropdownLink>
          )}
        </StyledButtonBar>
      </Container>
    );
  }
}

const SmartSearchBarContainer = createReactClass<Props>({
  displayName: 'SmartSearchBarContainer',

  mixins: [Reflux.listenTo(MemberListStore, 'onMemberListStoreChange') as any],

  getInitialState() {
    return {
      members: MemberListStore.getAll(),
    };
  },

  onMemberListStoreChange(members: any) {
    this.setState({members}, this.updateAutoCompleteItems);
  },

  render() {
    // SmartSearchBar doesn't use members, but we forward it to cause a re-render.
    return <SmartSearchBar {...this.props} members={this.state.members} />;
  },
});

export default withApi(withOrganization(SmartSearchBarContainer));
export {SmartSearchBar};

const Container = styled('div')<{isOpen: boolean}>`
  border: 1px solid ${p => (p.isOpen ? p.theme.borderDark : p.theme.borderLight)};
  border-radius: ${p =>
    p.isOpen
      ? `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`
      : p.theme.borderRadius};
  /* match button height */
  height: 40px;
  box-shadow: inset ${p => p.theme.dropShadowLight};
  background: #fff;

  position: relative;

  display: flex;

  .show-sidebar & {
    background: ${p => p.theme.gray100};
  }
`;

const DropdownWrapper = styled('div')<{visible: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const StyledForm = styled('form')`
  flex-grow: 1;
`;

const StyledInput = styled('input')`
  color: ${p => p.theme.gray700};
  background: transparent;
  border: 0;
  outline: none;

  font-size: ${p => p.theme.fontSizeMedium};
  width: 100%;
  height: 40px;
  line-height: 40px;
  padding: 0 0 0 ${space(1)};

  &::placeholder {
    color: ${p => p.theme.gray400};
  }
  &:focus {
    border-color: ${p => p.theme.borderDark};
    border-bottom-right-radius: 0;
  }

  .show-sidebar & {
    color: ${p => p.theme.disabled};
  }
`;

const InputButton = styled(Button)`
  ${getInputButtonStyles}
`;

const SearchBuilderButton = styled(InputButton)`
  margin-left: ${space(0.25)};
  margin-right: ${space(0.5)};
`;

const StyledDropdownLink = styled(DropdownLink)`
  display: none;

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: flex;
  }
`;

const DropdownElement = styled('a')`
  ${getDropdownElementStyles}
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-right: ${space(1)};
`;

const EllipsisButton = styled(InputButton)`
  /*
   * this is necessary because DropdownLink wraps the button in an unstyled
   * span
   */
  margin: 6px 0 0 0;
`;

const VerticalEllipsisIcon = styled(IconEllipsis)`
  transform: rotate(90deg);
`;

const SearchLabel = styled('label')`
  display: flex;
  align-items: center;
  margin: 0;
  padding-left: ${space(1)};
  color: ${p => p.theme.gray500};
`;
