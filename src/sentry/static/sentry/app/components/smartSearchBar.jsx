import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import _ from 'lodash';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {t} from 'app/locale';
import MemberListStore from 'app/stores/memberListStore';
import SearchDropdown from 'app/views/stream/searchDropdown';
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
    defaultQuery: PropTypes.string,
    query: PropTypes.string,
    defaultSearchItems: PropTypes.array.isRequired,
    disabled: PropTypes.bool,
    placeholder: PropTypes.string,

    // Map of tags
    supportedTags: PropTypes.object,

    onGetTagValues: PropTypes.func,

    onSearch: PropTypes.func,
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
    let cursorOffset = query.slice(cursor).search(/\s|$/);
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

  DROPDOWN_BLUR_DURATION = 200;

  blur = () => {
    if (!this.searchInput.current) {
      return;
    }
    this.searchInput.current.blur();
  };

  onSubmit = evt => {
    evt.preventDefault();
    this.blur();
    this.props.onSearch(removeSpace(this.state.query));
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
  getTagKeys = function(query) {
    const {supportedTags} = this.props;
    const tagKeys = Object.keys(supportedTags)
      .map(key => `${key}:`)
      .filter(key => key.indexOf(query) > -1);

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
  getTagValues = _.debounce((tag, query, callback) => {
    // Strip double quotes if there are any
    query = query.replace(/"/g, '').trim();

    this.setState({
      loading: true,
    });

    this.props.onGetTagValues(tag, query).then(
      values => {
        this.setState({loading: false});
        callback(
          values.map(value => {
            // Wrap in quotes if there is a space
            return value.indexOf(' ') > -1 ? `"${value}"` : value;
          }),
          tag.key,
          query
        );
      },
      () => {
        this.setState({loading: false});
      }
    );
  }, 300);

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with results
   */
  getPredefinedTagValues = function(tag, query, callback) {
    let values = tag.values.filter(value => value.indexOf(query) > -1);

    callback(values, tag.key);
  };

  onInputClick = () => {
    this.updateAutoCompleteItems();
  };

  updateAutoCompleteItems = () => {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }

    let cursor = this.getCursorPosition();
    let query = this.state.query;

    let lastTermIndex = SmartSearchBar.getLastTermIndex(query, cursor);
    let terms = SmartSearchBar.getQueryTerms(query.slice(0, lastTermIndex));

    if (
      !terms || // no terms
      terms.length === 0 || // no terms
      (terms.length === 1 && terms[0] === this.props.defaultQuery) || // default term
      /^\s+$/.test(query.slice(cursor - 1, cursor + 1))
    ) {
      // cursor on whitespace
      // show default "help" search terms
      return void this.setState({
        searchTerm: '',
        searchItems: this.props.defaultSearchItems,
        activeSearchItem: 0,
      });
    }

    let last = terms.pop();
    let autoCompleteItems;
    let matchValue;
    let tagName;
    let index = last.indexOf(':');

    if (index === -1) {
      // No colon present; must still be deciding key
      matchValue = last;
      autoCompleteItems = this.getTagKeys(matchValue);

      this.setState({searchTerm: matchValue});
      this.updateAutoCompleteState(autoCompleteItems, matchValue);
    } else {
      let {supportedTags} = this.props;
      tagName = last.slice(0, index);
      query = last.slice(index + 1);

      // filter existing items immediately, until API can return
      // with actual tag value results
      let filteredSearchItems = this.state.searchItems.filter(
        item => query && item.value.indexOf(query) !== -1
      );

      this.setState({
        searchTerm: query,
        searchItems: filteredSearchItems,
      });

      let tag = supportedTags[tagName];

      if (!tag) return undefined;

      // Ignore the environment tag if the feature is active and excludeEnvironment = true
      if (this.props.excludeEnvironment && tagName === 'environment') {
        return undefined;
      }

      return void (tag.predefined ? this.getPredefinedTagValues : this.getTagValues)(
        tag,
        query,
        this.updateAutoCompleteState
      );
    }
    return undefined;
  };

  isDefaultDropdown = () => {
    return this.state.searchItems === this.props.defaultSearchItems;
  };

  updateAutoCompleteState = (autoCompleteItems, tagName) => {
    autoCompleteItems = autoCompleteItems.map(item => {
      let out = {
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
          out.className = 'icon-clock';
          break;
        default:
          out.className = 'icon-tag';
      }
      return out;
    });

    if (autoCompleteItems.length > 0 && !this.isDefaultDropdown()) {
      autoCompleteItems[0].active = true;
    }

    this.setState({
      searchItems: autoCompleteItems.slice(0, 5), // only show 5
      activeSearchItem: 0,
    });
  };

  onKeyDown = evt => {
    let state = this.state;
    let searchItems = state.searchItems;

    if (!searchItems.length) return;

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
    } else if (evt.key === 'Tab' && !this.isDefaultDropdown()) {
      evt.preventDefault();

      this.onAutoComplete(searchItems[state.activeSearchItem].value);
    }
  };

  onAutoComplete = replaceText => {
    let cursor = this.getCursorPosition();
    let query = this.state.query;

    let lastTermIndex = SmartSearchBar.getLastTermIndex(query, cursor);
    let terms = SmartSearchBar.getQueryTerms(query.slice(0, lastTermIndex));
    let newQuery;

    // If not postfixed with : (tag value), add trailing space
    let lastChar = replaceText.charAt(replaceText.length - 1);
    replaceText += lastChar === ':' || lastChar === '.' ? '' : ' ';

    if (!terms) {
      newQuery = replaceText;
    } else {
      let last = terms.pop();

      newQuery = query.slice(0, lastTermIndex); // get text preceding last term

      newQuery =
        last.indexOf(':') > -1
          ? // tag key present: replace everything after colon with replaceText
            newQuery.replace(/\:"[^"]*"?$|\:\S*$/, ':' + replaceText)
          : // no tag key present: replace last token with replaceText
            newQuery.replace(/\S+$/, replaceText);

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
    let {className, disabled} = this.props;

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
              <div>
                <a className="search-clear-form" onClick={this.clearSearch}>
                  <span className="icon-circle-cross" />
                </a>
              </div>
            )}
          </div>

          {(this.state.loading || this.state.searchItems.length > 0) && (
            <DropdownWrapper visible={this.state.dropdownVisible}>
              <SearchDropdown
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

const SmartSearchBarContainer = withOrganization(
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
      return <SmartSearchBar {...this.props} members={this.state.members} />;
    },
  })
);

const DropdownWrapper = styled('div')`
  display: ${p => (p.visible ? 'block' : 'none')};
`;

export default SmartSearchBarContainer;
export {SmartSearchBar};
