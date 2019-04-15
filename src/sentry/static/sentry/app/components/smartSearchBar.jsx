import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import * as Sentry from '@sentry/browser';
import _ from 'lodash';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'app/constants';
import {defined} from 'app/utils';
import {
  fetchRecentSearches,
  pinSearch,
  saveRecentSearch,
  unpinSearch,
} from 'app/actionCreators/savedSearches';
import {t} from 'app/locale';
import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';
import MemberListStore from 'app/stores/memberListStore';
import SearchDropdown from 'app/views/stream/searchDropdown';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

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
class SmartSearchBar extends React.Component {
  static propTypes = {
    api: PropTypes.object,

    organization: SentryTypes.Organization,

    orgId: PropTypes.string,

    // Class name for search dropdown
    dropdownClassName: PropTypes.string,

    defaultQuery: PropTypes.string,

    query: PropTypes.string,

    /**
     * Prepare query value before filtering dropdown items
     */
    prepareQuery: PropTypes.func,

    // Search items to display when there's no tag key
    defaultSearchItems: PropTypes.array.isRequired,

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
    displayRecentSearches: PropTypes.bool,

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

    onSavedRecentSearch: PropTypes.func,

    // If true, excludes the environment tag from the autocompletion list
    // This is because we don't want to treat environment as a tag in some places
    // such as the stream view where it is a top level concept
    excludeEnvironment: PropTypes.bool,
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
    defaultSearchItems: [],
  };

  constructor(props) {
    super(props);

    this.state = {
      query: props.query !== null ? addSpace(props.query) : props.defaultQuery,

      searchTerm: '',
      searchItems: [],
      activeSearchItem: 0,

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

  DROPDOWN_BLUR_DURATION = 200;

  blur = () => {
    if (!this.searchInput.current) {
      return;
    }
    this.searchInput.current.blur();
  };

  onSubmit = evt => {
    evt.preventDefault();
    this.doSearch();
  };

  doSearch = async () => {
    const {onSearch, onSavedRecentSearch, api, orgId, savedSearchType} = this.props;
    this.blur();
    const query = removeSpace(this.state.query);
    onSearch(query);

    // Only save recent search query if we have a savedSearchType (also 0 is a valid value)
    // Do not save empty string queries (i.e. if they clear search)
    if (typeof savedSearchType !== 'undefined' && query) {
      try {
        await saveRecentSearch(api, orgId, savedSearchType, query);

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
    }, this.DROPDOWN_BLUR_DURATION);
  };

  onQueryChange = evt => {
    this.setState({query: evt.target.value}, () => this.updateAutoCompleteItems());
  };

  onKeyUp = evt => {
    if (evt.key === 'Escape' || evt.keyCode === 27) {
      // blur handler should additionally hide dropdown
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
      return tagKeys.filter(key => key !== 'environment:');
    } else {
      return tagKeys;
    }
  };

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getTagValues = _.debounce(
    async (tag, query) => {
      // Strip double quotes if there are any
      query = query.replace(/"/g, '').trim();

      this.setState({
        loading: true,
      });

      try {
        const values = await this.props.onGetTagValues(tag, query);
        this.setState({loading: false});
        return values.map(value => {
          // Wrap in quotes if there is a space
          return value.indexOf(' ') > -1 ? `"${value}"` : value;
        });
      } catch (err) {
        this.setState({loading: false});
        Sentry.captureException(err);

        return [];
      }
    },
    300,
    {leading: true}
  );

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with results
   */
  getPredefinedTagValues = function(tag, query) {
    return tag.values.filter(value => value.indexOf(query) > -1);
  };

  /**
   * Get recent searches
   */
  getRecentSearches = _.debounce(
    async () => {
      const {savedSearchType, displayRecentSearches, onGetRecentSearches} = this.props;
      // `savedSearchType` can be 0
      if (!defined(savedSearchType) || !displayRecentSearches) {
        return [];
      }

      const fetchFn = onGetRecentSearches || this.fetchRecentSearches;
      return fetchFn(this.state.query);
    },
    300,
    {leading: true}
  );

  fetchRecentSearches = async fullQuery => {
    const {api, orgId, savedSearchType} = this.props;

    const recentSearches = await fetchRecentSearches(
      api,
      orgId,
      savedSearchType,
      fullQuery
    );

    return (recentSearches && recentSearches.map(({query}) => ({query}))) || [];
  };

  onInputClick = () => {
    this.updateAutoCompleteItems();
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
      const {defaultSearchItems} = this.props;

      if (!defaultSearchItems.length) {
        // Update searchTerm, otherwise <SearchDropdown> will have wrong state
        // (e.g. if you delete a query, the last letter will be highlighted if `searchTerm`
        // does not get updated)
        this.setState({
          searchTerm: query,
        });

        const tagKeys = this.getTagKeys('');
        const recentSearches = await this.getRecentSearches();
        this.updateAutoCompleteState(tagKeys, recentSearches, '');
        return;
      }

      // cursor on whitespace
      // show default "help" search terms
      this.setState({
        searchTerm: '',
        searchItems: defaultSearchItems,
        activeSearchItem: 0,
      });

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
      this.updateAutoCompleteState(autoCompleteItems, recentSearches, matchValue);
    } else {
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
        : this.state.searchItems.filter(item => item.value.indexOf(preparedQuery) !== -1);

      this.setState({
        searchTerm: query,
        searchItems: filteredSearchItems,
      });

      const tag = supportedTags[tagName];

      if (!tag) {
        return;
      }

      // Ignore the environment tag if the feature is active and excludeEnvironment = true
      if (this.props.excludeEnvironment && tagName === 'environment') {
        return;
      }

      const fetchTagValuesFn = tag.predefined
        ? this.getPredefinedTagValues
        : this.getTagValues;

      const [tagValues, recentSearches] = await Promise.all([
        fetchTagValuesFn(tag, preparedQuery),
        this.getRecentSearches(),
      ]);

      this.updateAutoCompleteState(tagValues, recentSearches, tag.key);
      return;
    }
    return;
  };

  isDefaultDropdownItem = item => item.type === 'default';

  updateAutoCompleteState = (searchItems, recentSearchItems, tagName) => {
    const {maxSearchItems} = this.props;

    searchItems = searchItems.map(item => {
      const out = {
        desc: item,
        value: item,
      };

      // Specify icons according to tag value
      switch (tagName || item.replace(':', '')) {
        case 'is':
          out.className = 'icon-toggle';
          break;
        case 'assigned':
        case 'bookmarks':
          out.className = 'icon-user';
          break;
        case 'firstSeen':
        case 'lastSeen':
        case 'event.timestamp':
          out.className = 'icon-av_timer';
          break;
        default:
          out.className = 'icon-tag';
      }

      if (item.type === 'recent-search') {
        out.className = 'icon-clock';
      }

      return out;
    });

    if (searchItems.length > 0) {
      searchItems[0].active = true;
    }

    if (maxSearchItems && maxSearchItems > 0) {
      searchItems = searchItems.slice(0, maxSearchItems);
    }

    const recentItems = recentSearchItems.map(item => ({
      desc: item.query,
      value: item.query,
      className: 'icon-clock',
      type: 'recent-search',
    }));

    this.setState({
      searchItems: [...searchItems, ...recentItems],
      activeSearchItem: 0,
    });
  };

  onTogglePinnedSearch = evt => {
    const {
      api,
      organization,
      savedSearchType,
      hasPinnedSearch,
      pinnedSearch,
    } = this.props;

    evt.preventDefault();
    evt.stopPropagation();

    if (!defined(savedSearchType) || !hasPinnedSearch) {
      return;
    }

    if (!!pinnedSearch) {
      unpinSearch(api, organization.slug, savedSearchType, pinnedSearch);
    } else {
      pinSearch(api, organization.slug, savedSearchType, this.state.query);
    }
  };

  onKeyDown = evt => {
    const state = this.state;
    const searchItems = state.searchItems;

    if (!searchItems.length) {
      return;
    }

    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault();

      // Move active selection up/down
      delete searchItems[state.activeSearchItem].active;

      state.activeSearchItem =
        evt.key === 'ArrowDown'
          ? Math.min(state.activeSearchItem + 1, searchItems.length - 1)
          : Math.max(state.activeSearchItem - 1, 0);

      searchItems[state.activeSearchItem].active = true;
      this.setState({searchItems: searchItems.slice(0)});
    } else if (evt.key === 'Tab') {
      evt.preventDefault();
      const item = searchItems[state.activeSearchItem];

      if (!this.isDefaultDropdownItem(item)) {
        this.onAutoComplete(item.value, item);
      }
    }
  };

  onAutoComplete = (replaceText, item) => {
    if (item.type === 'recent-search') {
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
    const {className, dropdownClassName, disabled} = this.props;

    return (
      <div
        className={classNames(
          'search',
          {
            disabled,
          },
          className
        )}
      >
        <form className="form-horizontal" onSubmit={this.onSubmit}>
          <div>
            <input
              type="text"
              className="search-input form-control"
              placeholder={this.props.placeholder}
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
              disabled={this.props.disabled}
            />
            <span className="icon-search" />
            {this.state.query !== '' && (
              <React.Fragment>
                {this.props.hasPinnedSearch && (
                  <PinButton
                    type="button"
                    borderless
                    size="zero"
                    onClick={this.onTogglePinnedSearch}
                  >
                    <PinIcon isPinned={!!this.props.pinnedSearch} src="icon-pin" />
                  </PinButton>
                )}
                <a className="search-clear-form" onClick={this.clearSearch}>
                  <span className="icon-circle-cross" />
                </a>
              </React.Fragment>
            )}
          </div>

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
        </form>
      </div>
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

const PinButton = styled(Button)`
  margin-right: ${space(0.5)};
  position: absolute;
  right: 26px;
  top: 10px;
`;

const PinIcon = styled(InlineSvg)`
  fill: ${p => (p.isPinned ? p.theme.blueLight : p.theme.gray2)};
  &:hover {
    fill: ${p => p.theme.blueLight};
  }
`;

const DropdownWrapper = styled('div')`
  display: ${p => (p.visible ? 'block' : 'none')};
`;

export default SmartSearchBarContainer;
export {SmartSearchBar};
