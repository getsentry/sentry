import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import * as Sentry from '@sentry/browser';
import debounce from 'lodash/debounce';
import createReactClass from 'create-react-class';
import styled, {css} from 'react-emotion';

import {
  DEFAULT_DEBOUNCE_DURATION,
  MAX_AUTOCOMPLETE_RELEASES,
  NEGATION_OPERATOR,
  SEARCH_WILDCARD,
} from 'app/constants';
import {analytics} from 'app/utils/analytics';
import {callIfFunction} from 'app/utils/callIfFunction';
import {defined} from 'app/utils';
import {
  fetchRecentSearches,
  pinSearch,
  saveRecentSearch,
  unpinSearch,
} from 'app/actionCreators/savedSearches';
import {fetchReleases} from 'app/actionCreators/releases';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import CreateSavedSearchButton from 'app/views/issueList/createSavedSearchButton';
import InlineSvg from 'app/components/inlineSvg';
import DropdownLink from 'app/components/dropdownLink';
import MemberListStore from 'app/stores/memberListStore';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';

import SearchDropdown from './searchDropdown';

const DROPDOWN_BLUR_DURATION = 200;

const getMediaQuery = (size, type) => `
  display: ${type};

  @media (min-width: ${size}) {
    display: ${type === 'none' ? 'block' : 'none'};
  }
`;

const getInputButtonStyles = p => css`
  color: ${p.isActive ? theme.blueLight : theme.gray2};
  margin-left: ${space(0.5)};
  width: 18px;

  &,
  &:hover,
  &:focus {
    background: transparent;
  }

  &:hover {
    color: ${theme.gray3};
  }

  ${p.collapseIntoEllipsisMenu &&
    getMediaQuery(theme.breakpoints[p.collapseIntoEllipsisMenu], 'none')};
`;

const getDropdownElementStyles = p => css`
  padding: 0 ${space(1)} ${p.last ? null : space(0.5)};
  margin-bottom: ${p.last ? null : space(0.5)};
  display: none;
  color: ${theme.gray4};
  align-items: center;
  min-width: 190px;
  height: 38px;
  padding-left: ${space(1.5)};
  padding-right: ${space(1.5)};

  &,
  &:hover,
  &:focus {
    border-bottom: ${p.last ? null : `1px solid ${theme.gray1}`};
    border-radius: 0;
  }

  &:hover {
    color: ${theme.blueDark};
  }

  ${p.showBelowMediaQuery &&
    getMediaQuery(theme.breakpoints[p.showBelowMediaQuery], 'flex')}
`;

class SmartSearchBar extends React.Component {
  static propTypes = {
    api: PropTypes.object,

    organization: SentryTypes.Organization.isRequired,

    dropdownClassName: PropTypes.string,

    defaultQuery: PropTypes.string,

    query: PropTypes.string,

    /**
     * Prepare query value before filtering dropdown items
     */
    prepareQuery: PropTypes.func,

    // Search items to display when there's no tag key
    // Should be a tuple of [searchItems[], recentSearchItems[]]
    defaultSearchItems: PropTypes.array,

    // Disabled control (e.g. read-only)
    disabled: PropTypes.bool,

    // Input placeholder
    placeholder: PropTypes.string,

    // Map of tags
    supportedTags: PropTypes.object,

    // Maximum number of search items to display
    // or a falsey value for no maximum
    maxSearchItems: PropTypes.number,

    // List user's recent searches
    hasRecentSearches: PropTypes.bool,

    // Has search builder UI
    hasSearchBuilder: PropTypes.bool,

    // Can create a saved search
    canCreateSavedSearch: PropTypes.bool,

    // Wrap the input with a form
    // Useful if search bar is used within a parent form
    useFormWrapper: PropTypes.bool,

    /**
     * If this is defined, attempt to save search term scoped to the user and the current org
     */
    savedSearchType: PropTypes.number,

    /**
     * Has pinned search feature
     */
    hasPinnedSearch: PropTypes.bool,

    /**
     * The pinned search object
     */
    pinnedSearch: SentryTypes.SavedSearch,

    // Callback that returns a promise of an array of strings
    onGetTagValues: PropTypes.func,

    // Callback that returns a promise of an array of strings
    onGetRecentSearches: PropTypes.func,

    onSearch: PropTypes.func,

    // Search input change event
    onChange: PropTypes.func,

    // Search input blur event
    onBlur: PropTypes.func,

    onSavedRecentSearch: PropTypes.func,

    onSidebarToggle: PropTypes.func,

    // If true, excludes the environment tag from the autocompletion list
    // This is because we don't want to treat environment as a tag in some places
    // such as the stream view where it is a top level concept
    excludeEnvironment: PropTypes.bool,
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  /**
   * Given a query, and the current cursor position, return the string-delimiting
   * index of the search term designated by the cursor.
   */
  static getLastTermIndex = (query, cursor) => {
    // TODO: work with quoted-terms
    const cursorOffset = query.slice(cursor).search(/\s|$/);
    return cursor + (cursorOffset === -1 ? 0 : cursorOffset);
  };

  /**
   * Returns an array of query terms, including incomplete terms
   *
   * e.g. ["is:unassigned", "browser:\"Chrome 33.0\"", "assigned"]
   */
  static getQueryTerms = (query, cursor) => {
    return query.slice(0, cursor).match(/\S+:"[^"]*"?|\S+/g);
  };

  static defaultProps = {
    defaultQuery: '',
    query: null,
    onSearch: function() {},
    excludeEnvironment: false,
    placeholder: t('Search for events, users, tags, and everything else.'),
    supportedTags: {},
    defaultSearchItems: [[], []],
    hasPinnedSearch: false,
    useFormWrapper: true,
  };

  constructor(props) {
    super(props);

    this.state = {
      query: props.query !== null ? addSpace(props.query) : props.defaultQuery,
      noValueQuery: undefined,

      searchTerm: '',
      searchItems: [],
      activeSearchItem: -1,

      tags: {},

      dropdownVisible: false,
      loading: false,
    };

    this.searchInput = React.createRef();
  }

  componentWillReceiveProps(nextProps) {
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
      this.blurTimeout = null;
    }
  }

  blur = () => {
    if (!this.searchInput.current) {
      return;
    }
    this.searchInput.current.blur();
  };

  onSubmit = evt => {
    const {organization, savedSearchType} = this.props;
    evt.preventDefault();

    analytics('search.searched', {
      org_id: parseInt(organization.id, 10),
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
    onSearch(query);

    // Only save recent search query if we have a savedSearchType (also 0 is a valid value)
    // Do not save empty string queries (i.e. if they clear search)
    if (typeof savedSearchType !== 'undefined' && query) {
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
  };

  clearSearch = () => {
    this.setState({query: ''}, () => this.props.onSearch(this.state.query));
  };

  onQueryFocus = () => {
    this.setState({
      dropdownVisible: true,
    });
  };

  onQueryBlur = () => {
    // wait 200ms before closing dropdown in case blur was a result of
    // clicking a menu option
    this.blurTimeout = setTimeout(() => {
      this.blurTimeout = null;
      this.setState({dropdownVisible: false});
      callIfFunction(this.props.onBlur);
    }, DROPDOWN_BLUR_DURATION);
  };

  onQueryChange = evt => {
    this.setState({query: evt.target.value}, () => this.updateAutoCompleteItems());
    callIfFunction(this.props.onChange, evt.target.value, evt);
  };

  onInputClick = () => {
    this.updateAutoCompleteItems();
  };

  onKeyDown = evt => {
    if (!this.state.searchItems.length) {
      return;
    }

    const {useFormWrapper} = this.props;
    const {key} = evt;
    const isSelectingDropdownItems = this.state.activeSearchItem !== -1;

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      evt.preventDefault();

      const {searchItems, flatSearchItems, activeSearchItem} = this.state;
      const [groupIndex, childrenIndex] = isSelectingDropdownItems
        ? findSearchItemByIndex(searchItems, activeSearchItem)
        : [];

      // Remove the previous 'active' property
      if (typeof groupIndex !== 'undefined') {
        if (
          searchItems[groupIndex] &&
          searchItems[groupIndex].children &&
          searchItems[groupIndex].children[childrenIndex]
        ) {
          delete searchItems[groupIndex].children[childrenIndex].active;
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

      const [nextGroupIndex, nextChildrenIndex] = findSearchItemByIndex(
        searchItems,
        nextActiveSearchItem
      );

      // Make sure search items exist (e.g. both groups could be empty) and
      // attach the 'active' property to the item
      if (searchItems[nextGroupIndex] && searchItems[nextGroupIndex].children) {
        searchItems[nextGroupIndex].children[nextChildrenIndex] = {
          ...searchItems[nextGroupIndex].children[nextChildrenIndex],
          active: true,
        };
      }

      this.setState({
        activeSearchItem: nextActiveSearchItem,
        searchItems: searchItems.slice(0),
      });
    } else if ((key === 'Tab' || key === 'Enter') && isSelectingDropdownItems) {
      evt.preventDefault();

      const {activeSearchItem, searchItems} = this.state;
      const [groupIndex, childrenIndex] = findSearchItemByIndex(
        searchItems,
        activeSearchItem
      );
      const item = searchItems[groupIndex].children[childrenIndex];

      if (item && !this.isDefaultDropdownItem(item)) {
        this.onAutoComplete(item.value, item);
      }
    } else if (key === 'Enter' && !useFormWrapper && !isSelectingDropdownItems) {
      // If enter is pressed, and we are not wrapping input in a `<form>`, and
      // we are not selecting an item from the dropdown, then we should consider
      // the user as finished selecting and perform a "search" since there is no
      // `<form>` to catch and call `this.onSubmit`
      this.doSearch();
    }
  };

  onKeyUp = evt => {
    // Other keys are managed at onKeyDown function
    if (evt.key !== 'Escape') {
      return;
    }

    evt.preventDefault();
    const isSelectingDropdownItems = this.state.activeSearchItem > -1;

    if (isSelectingDropdownItems) {
      const {searchItems, activeSearchItem} = this.state;
      const [groupIndex, childrenIndex] = isSelectingDropdownItems
        ? findSearchItemByIndex(searchItems, activeSearchItem)
        : [];

      if (groupIndex !== undefined && childrenIndex !== undefined) {
        delete searchItems[groupIndex].children[childrenIndex].active;
      }

      this.setState({
        activeSearchItem: -1,
        searchItems: this.state.searchItems.slice(0),
      });
    } else {
      // Blur handler should additionally hide dropdown
      this.blur();
    }
  };

  getCursorPosition = () => {
    if (!this.searchInput.current) {
      return -1;
    }
    return this.searchInput.current.selectionStart;
  };

  /**
   * Returns array of possible key values that substring match `query`
   *
   * e.g. ['is:', 'assigned:', 'url:', 'release:']
   */
  getTagKeys = query => {
    const {supportedTags, prepareQuery} = this.props;

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
    async (tag, query) => {
      // Strip double quotes if there are any
      query = query.replace(/"/g, '').trim();

      this.setState({
        loading: true,
      });

      try {
        const {location} = this.context.router;
        const endpointParams = getParams(location.query);

        if (
          this.state.noValueQuery === undefined ||
          !query.startsWith(this.state.noValueQuery)
        ) {
          const values = await this.props.onGetTagValues(tag, query, endpointParams);
          this.setState({loading: false});
          const noValueQuery =
            values.length === 0 && query.length > 0 ? query : undefined;
          this.setState({noValueQuery});
          return values.map(value => {
            // Wrap in quotes if there is a space
            const escapedValue =
              value.indexOf(' ') > -1 ? `"${value.replace('"', '\\"')}"` : value;
            return {
              value: escapedValue,
              desc: escapedValue,
            };
          });
        } else {
          this.setState({loading: false});
          return [];
        }
      } catch (err) {
        this.setState({loading: false});
        Sentry.captureException(err);

        return [];
      }
    },
    DEFAULT_DEBOUNCE_DURATION,
    {leading: true}
  );

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with results
   */
  getPredefinedTagValues = function(tag, query) {
    return tag.values
      .filter(value => value.indexOf(query) > -1)
      .map(value => ({
        value,
        desc: value,
      }));
  };

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

  fetchRecentSearches = async fullQuery => {
    const {api, organization, savedSearchType} = this.props;

    try {
      const recentSearches = await fetchRecentSearches(
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
    async (tag, query) => {
      const releasePromise = this.fetchReleases(query);

      const tags = this.getPredefinedTagValues(tag, query);
      const tagValues = tags.map(v => ({
        ...v,
        type: 'first-release',
      }));

      const releases = await releasePromise;
      const releaseValues = releases.map(r => ({
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
  fetchReleases = async query => {
    const {api, organization} = this.props;
    const {location} = this.context.router;

    const project = location && location.query ? location.query.projectId : undefined;

    try {
      return await fetchReleases(
        api,
        organization.slug,
        project,
        query,
        MAX_AUTOCOMPLETE_RELEASES
      );
    } catch (e) {
      Sentry.captureException(e);
    }

    return [];
  };

  updateAutoCompleteItems = async () => {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }

    const cursor = this.getCursorPosition();
    let query = this.state.query;

    const lastTermIndex = SmartSearchBar.getLastTermIndex(query, cursor);
    const terms = SmartSearchBar.getQueryTerms(query.slice(0, lastTermIndex));

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
        this.setState({
          searchTerm: query,
        });

        const tagKeys = this.getTagKeys('');
        const recentSearches = await this.getRecentSearches();
        this.updateAutoCompleteState(tagKeys, recentSearches, '', 'tag-key');
        return;
      }

      // cursor on whitespace
      // show default "help" search terms
      this.setState({
        searchTerm: '',
      });

      this.updateAutoCompleteState(defaultSearchItems, defaultRecentItems, '', 'default');
      return;
    }

    const last = terms.pop();
    let autoCompleteItems;
    let matchValue;
    let tagName;
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

    const {supportedTags, prepareQuery} = this.props;

    // TODO(billy): Better parsing for these examples
    // sentry:release:
    // url:"http://with/colon"
    tagName = last.slice(0, index);

    // e.g. given "!gpu" we want "gpu"
    tagName = tagName.replace(new RegExp(`^${NEGATION_OPERATOR}`), '');
    query = last.slice(index + 1);
    const preparedQuery =
      typeof prepareQuery === 'function' ? prepareQuery(query) : query;

    // filter existing items immediately, until API can return
    // with actual tag value results
    const filteredSearchItems = !preparedQuery
      ? this.state.searchItems
      : this.state.searchItems.filter(
          item => item.value && item.value.indexOf(preparedQuery) !== -1
        );

    this.setState({
      searchTerm: query,
      searchItems: filteredSearchItems,
    });

    const tag = supportedTags[tagName];

    if (!tag) {
      this.updateAutoCompleteState([], [], tagName, 'invalid-tag');
      return;
    }

    // Ignore the environment tag if the feature is active and excludeEnvironment = true
    if (this.props.excludeEnvironment && tagName === 'environment') {
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

  isDefaultDropdownItem = item => item && item.type === 'default';

  /**
   * Updates autocomplete dropdown items and autocomplete index state
   *
   * @param {Object[]} searchItems List of search item objects with keys: title, desc, value
   * @param {Object[]} recentSearchItems List of recent search items, same format as searchItem
   * @param {String} tagName The current tag name in scope
   * @param {String} type Defines the type/state of the dropdown menu items
   */
  updateAutoCompleteState = (searchItems, recentSearchItems, tagName, type) => {
    const {hasRecentSearches, maxSearchItems} = this.props;

    this.setState(
      createSearchGroups(
        searchItems,
        hasRecentSearches ? recentSearchItems : null,
        tagName,
        type,
        maxSearchItems
      )
    );
  };

  onTogglePinnedSearch = evt => {
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

    if (!defined(savedSearchType) || !hasPinnedSearch) {
      return;
    }

    // eslint-disable-next-line no-unused-vars
    const {cursor: _cursor, page: _page, ...currentQuery} = router.location.query;

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
    } else {
      pinSearch(
        api,
        organization.slug,
        savedSearchType,
        removeSpace(this.state.query)
      ).then(resp => {
        if (resp && resp.id) {
          browserHistory.push({
            ...router.location,
            pathname: `/organizations/${organization.slug}/issues/searches/${resp.id}/`,
            query: currentQuery,
          });
        }
      });
    }

    analytics('search.pin', {
      org_id: parseInt(organization.id, 10),
      action: !!pinnedSearch ? 'unpin' : 'pin',
      search_type: savedSearchType === 0 ? 'issues' : 'events',
      query: pinnedSearch || this.state.query,
    });
  };

  onAutoComplete = (replaceText, item) => {
    if (item.type === 'recent-search') {
      analytics('search.searched', {
        org_id: parseInt(this.props.organization.id, 10),
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
    const terms = SmartSearchBar.getQueryTerms(query.slice(0, lastTermIndex));
    let newQuery;

    // If not postfixed with : (tag value), add trailing space
    const lastChar = replaceText.charAt(replaceText.length - 1);
    replaceText += lastChar === ':' || lastChar === '.' ? '' : ' ';

    if (!terms) {
      newQuery = replaceText;
    } else {
      const last = terms.pop();

      newQuery = query.slice(0, lastTermIndex); // get text preceding last term

      const prefix = newQuery.startsWith(NEGATION_OPERATOR) ? NEGATION_OPERATOR : '';
      const valuePrefix = newQuery.endsWith(SEARCH_WILDCARD) ? SEARCH_WILDCARD : '';

      // newQuery is "<term>:"
      // replaceText should be the selected value
      newQuery =
        last.indexOf(':') > -1
          ? // tag key present: replace everything after colon with replaceText
            newQuery.replace(/\:"[^"]*"?$|\:\S*$/, `:${valuePrefix}` + replaceText)
          : // no tag key present: replace last token with replaceText
            newQuery.replace(/\S+$/, `${prefix}${replaceText}`);

      newQuery = newQuery.concat(query.slice(lastTermIndex));
    }

    this.setState(
      {
        query: newQuery,
      },
      () => {
        // setting a new input value will lose focus; restore it
        if (this.searchInput.current) {
          this.searchInput.current.focus();
        }

        // then update the autocomplete box with new contextTypes
        this.updateAutoCompleteItems();
      }
    );
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
    } = this.props;

    const pinTooltip = !!pinnedSearch ? t('Unpin this search') : t('Pin this search');
    const pinIconSrc = !!pinnedSearch ? 'icon-pin-filled' : 'icon-pin';
    const hasQuery = !!this.state.query;

    const input = (
      <React.Fragment>
        <StyledInput
          type="text"
          placeholder={placeholder}
          id="smart-search-input"
          name="query"
          innerRef={this.searchInput}
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
        {(this.state.loading || this.state.searchItems.length > 0) && (
          <DropdownWrapper visible={this.state.dropdownVisible}>
            <SearchDropdown
              className={dropdownClassName}
              items={this.state.searchItems}
              onClick={this.onAutoComplete}
              loading={this.state.loading}
              searchSubstring={this.state.searchTerm}
            />
          </DropdownWrapper>
        )}
      </React.Fragment>
    );

    return (
      <Container
        className={className}
        isDisabled={disabled}
        isOpen={this.state.dropdownVisible}
      >
        <SearchLabel htmlFor="smart-search-input" aria-label={t('Search events')}>
          <SearchSvg src="icon-search" />
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
              <InlineSvg src="icon-close" size="11" />
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
            >
              <InlineSvg src={pinIconSrc} />
            </InputButton>
          )}
          {canCreateSavedSearch && (
            <CreateSavedSearchButton
              query={this.state.query}
              organization={organization}
              disabled={!hasQuery}
              withTooltip
              iconOnly
              buttonClassName={getInputButtonStyles({
                collapseIntoEllipsisMenu: 2,
              })}
            />
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
            >
              <InlineSvg src="icon-sliders" size="13" />
            </SearchBuilderButton>
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
                >
                  <EllipsisIcon src="icon-ellipsis-filled" />
                </EllipsisButton>
              }
            >
              {hasPinnedSearch && (
                <DropdownElement
                  showBelowMediaQuery={1}
                  data-test-id="pin-icon"
                  onClick={this.onTogglePinnedSearch}
                >
                  <MenuIcon src={pinIconSrc} size="13" />
                  {!!pinnedSearch ? 'Unpin Search' : 'Pin Search'}
                </DropdownElement>
              )}
              {canCreateSavedSearch && (
                <CreateSavedSearchButton
                  query={this.state.query}
                  organization={organization}
                  disabled={!hasQuery}
                  buttonClassName={getDropdownElementStyles({
                    showBelowMediaQuery: 2,
                    last: false,
                  })}
                />
              )}
              {hasSearchBuilder && (
                <DropdownElement showBelowMediaQuery={2} last onClick={onSidebarToggle}>
                  <MenuIcon src="icon-sliders" size="12" />
                  Toggle sidebar
                </DropdownElement>
              )}
            </StyledDropdownLink>
          )}
        </StyledButtonBar>
      </Container>
    );
  }
}

const SmartSearchBarContainer = withApi(
  withOrganization(
    createReactClass({
      displayName: 'SmartSearchBarContainer',

      mixins: [Reflux.listenTo(MemberListStore, 'onMemberListStoreChange')],

      getInitialState() {
        return {
          members: MemberListStore.getAll(),
        };
      },

      onMemberListStoreChange(members) {
        this.setState(
          {
            members,
          },
          this.updateAutoCompleteItems
        );
      },

      render() {
        // SmartSearchBar doesn't use members, but we forward it to cause a re-render.
        return <SmartSearchBar {...this.props} members={this.state.members} />;
      },
    })
  )
);

export function addSpace(query = '') {
  if (query.length !== 0 && query[query.length - 1] !== ' ') {
    return query + ' ';
  } else {
    return query;
  }
}

export function removeSpace(query = '') {
  if (query[query.length - 1] === ' ') {
    return query.slice(0, query.length - 1);
  } else {
    return query;
  }
}

const Container = styled('div')`
  border: 1px solid ${p => p.theme.borderLight};
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
    background: ${p => p.theme.offWhite};
  }
`;

const DropdownWrapper = styled('div')`
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const StyledForm = styled('form')`
  flex-grow: 1;
`;

const StyledInput = styled('input')`
  color: ${p => p.theme.foreground};
  background: transparent;
  border: 0;
  outline: none;

  font-size: ${p => p.theme.fontSizeMedium};
  width: 100%;
  height: 40px;
  line-height: 40px;
  padding: 0 0 0 ${space(1)};

  &::placeholder {
    color: ${p => p.theme.gray1};
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
  ${p => getInputButtonStyles(p)}
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

const MenuIcon = styled(InlineSvg)`
  margin-right: ${space(1)};
`;

const EllipsisButton = styled(InputButton)`
  /* this is necessary because DropdownLink wraps the button in an unstyled span */
  margin: 6px 0 0 0;
`;

const EllipsisIcon = styled(InlineSvg)`
  width: 12px;
  height: 12px;
  transform: rotate(90deg);
`;

const SearchLabel = styled('label')`
  display: flex;
  align-items: center;
  margin: 0;
  padding-left: ${space(1)};
  color: ${p => p.theme.gray2};
`;

const SearchSvg = styled(InlineSvg)`
  margin-top: ${space(0.25)};
  margin-left: ${space(0.25)};
`;

function getTitleForType(type) {
  if (type === 'tag-value') {
    return t('Tag Values');
  }

  if (type === 'recent-search') {
    return t('Recent Searches');
  }

  if (type === 'default') {
    return t('Common Search Terms');
  }

  return t('Tags');
}

function getIconForTypeAndTag(type, tagName) {
  if (type === 'recent-search') {
    return 'icon-clock';
  }

  if (type === 'default') {
    return 'icon-star-outline';
  }

  // Change based on tagName and default to "icon-tag"
  switch (tagName) {
    case 'is':
      return 'icon-toggle';
    case 'assigned':
    case 'bookmarks':
      return 'icon-user';
    case 'firstSeen':
    case 'lastSeen':
    case 'event.timestamp':
      return 'icon-av_timer';
    default:
      return 'icon-tag';
  }
}

function createSearchGroups(
  searchItems,
  recentSearchItems,
  tagName,
  type,
  maxSearchItems
) {
  const activeSearchItem = 0;

  if (maxSearchItems && maxSearchItems > 0) {
    searchItems = searchItems.slice(0, maxSearchItems);
  }

  const searchGroup = {
    title: getTitleForType(type),
    type: type === 'invalid-tag' ? type : 'header',
    icon: getIconForTypeAndTag(type, tagName),
    children: [...searchItems],
  };

  const recentSearchGroup = recentSearchItems && {
    title: t('Recent Searches'),
    type: 'header',
    icon: 'icon-clock',
    children: [...recentSearchItems],
  };

  if (searchGroup.children && !!searchGroup.children.length) {
    searchGroup.children[activeSearchItem] = {
      ...searchGroup.children[activeSearchItem],
    };
  }

  return {
    searchItems: [searchGroup, ...(recentSearchItems ? [recentSearchGroup] : [])],
    flatSearchItems: [...searchItems, ...(recentSearchItems ? recentSearchItems : [])],
    activeSearchItem: -1,
  };
}

/**
 * Items is a list of dropdown groups that have a `children` field.
 * Only the `children` are selectable, so we need to find which child is selected
 * given an index that is in range of the sum of all `children` lengths
 *
 * @return {Array} Returns a tuple of [groupIndex, childrenIndex]
 */
function findSearchItemByIndex(items, index, _total) {
  let _index = index;
  let foundSearchItem = [undefined, undefined];

  items.find(({children}, i) => {
    if (!children || !children.length) {
      return false;
    }
    if (_index < children.length) {
      foundSearchItem = [i, _index];
      return true;
    }

    _index -= children.length;
    return false;
  });

  return foundSearchItem;
}

export default SmartSearchBarContainer;
export {SmartSearchBar};
