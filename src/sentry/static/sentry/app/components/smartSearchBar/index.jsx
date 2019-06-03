import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import * as Sentry from '@sentry/browser';
import _ from 'lodash';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'app/constants';
import {analytics} from 'app/utils/analytics';
import {defined} from 'app/utils';
import {
  fetchRecentSearches,
  pinSearch,
  saveRecentSearch,
  unpinSearch,
} from 'app/actionCreators/savedSearches';
import {t} from 'app/locale';
import Button from 'app/components/button';
import CreateSavedSearchButton from 'app/views/organizationStream/createSavedSearchButton';
import InlineSvg from 'app/components/inlineSvg';
import DropdownLink from 'app/components/dropdownLink';
import MemberListStore from 'app/stores/memberListStore';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import SearchDropdown from './searchDropdown';

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
    const {organization, savedSearchType} = this.props;
    evt.preventDefault();

    analytics('search.searched', {
      org_id: parseInt(organization.id, 10),
      query: removeSpace(this.state.query),
      source: savedSearchType === 0 ? 'issues' : 'events',
      search_source: 'main_search',
    });

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
      tagKeys = tagKeys.filter(key => key !== 'environment:');
    }

    return tagKeys.map(value => ({value, desc: value}));
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
          const escapedValue =
            value.indexOf(' ') > -1 ? `"${value.replace('"', '\\"')}"` : value;
          return {
            value: escapedValue,
            desc: escapedValue,
          };
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

    return [
      ...(recentSearches &&
        recentSearches.map(({query}) => ({
          desc: query,
          value: query,
          type: 'recent-search',
        }))),
    ];
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

      const fetchTagValuesFn = tag.predefined
        ? this.getPredefinedTagValues
        : this.getTagValues;

      const [tagValues, recentSearches] = await Promise.all([
        fetchTagValuesFn(tag, preparedQuery),
        this.getRecentSearches(),
      ]);

      this.updateAutoCompleteState(tagValues, recentSearches, tag.key, 'tag-value');
      return;
    }
    return;
  };

  isDefaultDropdownItem = item => item.type === 'default';

  /**
   * Updates autocomplete dropdown items and autocomplete index state
   *
   * @param {Object[]} searchItems List of search item objects with keys: title, desc, value
   * @param {Object[]} recentSearchItems List of recent search items, same format as searchItem
   * @param {String} tagName The current tag name in scope
   * @param {String} type Defines the type/state of the dropdown menu items
   */
  updateAutoCompleteState = (searchItems, recentSearchItems, tagName, type) => {
    const {displayRecentSearches, maxSearchItems} = this.props;

    this.setState(
      createSearchGroups(
        searchItems,
        displayRecentSearches ? recentSearchItems : null,
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
      source: savedSearchType === 0 ? 'issues' : 'events',
      query: pinnedSearch || this.state.query,
    });
  };

  onKeyDown = evt => {
    if (!this.state.searchItems.length) {
      return;
    }

    const {key} = evt;

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      evt.preventDefault();

      this.setState(state => {
        const {searchItems, flatSearchItems, activeSearchItem} = state;
        const [groupIndex, childrenIndex] =
          findSearchItemByIndex(searchItems, activeSearchItem) || [];

        if (typeof groupIndex !== 'undefined') {
          if (
            searchItems[groupIndex] &&
            searchItems[groupIndex].children &&
            searchItems[groupIndex].children[childrenIndex]
          ) {
            delete searchItems[groupIndex].children[childrenIndex].active;
          }
        }

        const totalItems = flatSearchItems.length;

        // Move active selection up/down
        const nextActiveSearchItem =
          key === 'ArrowDown'
            ? (activeSearchItem + 1) % totalItems
            : (activeSearchItem - 1 + totalItems) % totalItems;

        const [nextGroupIndex, nextChildrenIndex] =
          findSearchItemByIndex(searchItems, nextActiveSearchItem) || [];

        // Make sure search items exist (e.g. both groups could be empty)
        if (searchItems[nextGroupIndex] && searchItems[nextGroupIndex].children) {
          searchItems[nextGroupIndex].children[nextChildrenIndex] = {
            ...searchItems[nextGroupIndex].children[nextChildrenIndex],
            active: true,
          };
        }

        return {
          activeSearchItem: nextActiveSearchItem,
          searchItems: searchItems.slice(0),
        };
      });
    } else if (key === 'Tab') {
      evt.preventDefault();

      const {activeSearchItem, searchItems} = this.state;
      const [groupIndex, childrenIndex] = findSearchItemByIndex(
        searchItems,
        activeSearchItem
      );
      const item = searchItems[groupIndex].children[childrenIndex];

      if (!this.isDefaultDropdownItem(item)) {
        this.onAutoComplete(item.value, item);
      }
    }
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
      hasPinnedSearch,
      organization,
      pinnedSearch,
      placeholder,
      disabled,
      onSidebarToggle,
    } = this.props;

    const pinTooltip = !!pinnedSearch ? t('Unpin this search') : t('Pin this search');
    const pinIconSrc = !!pinnedSearch ? 'icon-pin-filled' : 'icon-pin';
    const hasQuery = !!this.state.query;

    if (hasPinnedSearch) {
      return (
        <Container isDisabled={disabled} isOpen={this.state.dropdownVisible}>
          <StyledForm onSubmit={this.onSubmit}>
            <StyledInput
              type="text"
              placeholder={placeholder}
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
          </StyledForm>
          <ButtonBar>
            {this.state.query !== '' && (
              <CloseButton
                type="button"
                title={'Clear search'}
                borderless
                aria-label={'Clear search'}
                size="zero"
                containerDisplayMode="inline-flex"
                onClick={this.clearSearch}
              >
                <InlineSvg src="icon-close" size="11" />
              </CloseButton>
            )}
            <CreateSavedSearchButton
              query={this.state.query}
              organization={organization}
              disabled={!hasQuery}
            />
            <SidebarButton
              type="button"
              title={pinTooltip}
              borderless
              disabled={!hasQuery}
              aria-label={pinTooltip}
              size="zero"
              collapse={true}
              containerDisplayMode="inline-flex"
              onClick={this.onTogglePinnedSearch}
              isActive={!!pinnedSearch}
            >
              <InlineSvg src={pinIconSrc} />
            </SidebarButton>
            <SearchBuilderButton
              title={t('Toggle search builder')}
              borderless
              size="zero"
              collapse={true}
              containerDisplayMode="inline-flex"
              aria-label={t('Toggle search builder')}
              onClick={onSidebarToggle}
            >
              <InlineSvg src="icon-sliders" size={13} />
            </SearchBuilderButton>
            <StyledDropdownLink
              anchorRight={true}
              caret={false}
              title={
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <EllipsisIcon src="icon-ellipsis-filled"/>
                </div>
              }
            >
              <DropdownElement onClick={onSidebarToggle}>Toggle sidebar</DropdownElement>
              <DropdownElement last onClick={this.onTogglePinnedSearch}>
                {pinnedSearch ? 'Unpin search' : 'Pin search'}
              </DropdownElement>
            </StyledDropdownLink>
          </ButtonBar>
        </Container>
      );
    }
    const classes = classNames('search', {disabled}, className);

    return (
      <div className={classes}>
        <form className="form-horizontal" onSubmit={this.onSubmit}>
          <input
            type="text"
            className="search-input form-control"
            placeholder={placeholder}
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
          <span className="icon-search" />
          {this.state.query !== '' && (
            <a className="search-clear-form" onClick={this.clearSearch}>
              <span className="icon-circle-cross" />
            </a>
          )}
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

const Container = styled('div')`
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p =>
    p.isOpen
      ? `0 ${p.theme.borderRadius} 0 0`
      : `0 ${p.theme.borderRadius} ${p.theme.borderRadius} 0`};
  /* match button height */
  height: 40px;
  box-shadow: inset ${p => p.theme.dropShadowLight};
  background: #fff;

  flex-grow: 1;
  position: relative;

  z-index: ${p => p.theme.zIndex.dropdown};
  display: flex;

  .show-sidebar & {
    background: ${p => p.theme.offWhite};
  }
`;


const ButtonBar = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-right: ${space(1)};
  align-items: center;
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

const SidebarButton = styled(Button)`
  color: ${p => (p.isActive ? p.theme.blueLight : p.theme.gray2)};
  margin-left: ${space(0.5)};
  width: 18px;

  &:hover {
    color: ${p => p.theme.gray3};
  }

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

const SearchBuilderButton = styled(SidebarButton)`
  margin-left: ${space(0.25)};
  margin-right: ${space(0.5)};
`;

const CloseButton = styled(SidebarButton)`
  position: relative;
  margin-right: 6px;
`;

const StyledDropdownLink = styled(DropdownLink)`
  display: none;
  margin-left: ${space(0.5)};

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: flex;
  }
`;

const DropdownElement = styled('a')`
  padding: 0 ${space(1)} ${p => p.last ? null : space(0.5)};
  margin-bottom: ${p => p.last ? null : space(0.5)};
  border-bottom: ${p => p.last ? null : `1px solid ${p.theme.gray1}`};
  display: block;
`;

const EllipsisIcon = styled(InlineSvg)`
  color: ${p => p.theme.gray2};
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
      active: true,
    };
  }

  return {
    searchItems: [searchGroup, ...(recentSearchItems ? [recentSearchGroup] : [])],
    flatSearchItems: [...searchItems, ...(recentSearchItems ? recentSearchItems : [])],
    activeSearchItem,
  };
}

/**
 * Items is a list of dropdown groups that have a `children` field.
 * Only the `children` are selectable, so we need to find which child is selected
 * given an index that is in range of the sum of all `children` lengths
 *
 * @return {Array} Returns a tuple of [groupIndex, childrenIndex]
 */
function findSearchItemByIndex(items, index, total) {
  let _index = index;
  let foundSearchItem;
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
