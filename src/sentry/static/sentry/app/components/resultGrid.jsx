import React from 'react';
import $ from 'jquery';
import {browserHistory} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import DropdownLink from './dropdownLink';
import MenuItem from './menuItem';
import Pagination from './pagination';

const Filter = React.createClass({
  propTypes: {
    name: React.PropTypes.string.isRequired,
    queryKey: React.PropTypes.string.isRequired,
    options: React.PropTypes.array.isRequired,
    path: React.PropTypes.string.isRequired,
    value: React.PropTypes.any,
  },

  getCurrentLabel() {
    let selected = this.props.options.filter((item) => {
      return item[0] === (this.props.value || '');
    })[0];
    if (selected) return this.props.name + ': ' + selected[1];
    return this.props.name + ': ' + 'Any';
  },

  getDefaultItem() {
      let query = $.extend({}, this.props.location.query, {
        cursor: ''
      });
      delete query[this.props.queryKey];

      return (
        <MenuItem
          key=""
          isActive={this.props.value === '' || !this.props.value}
          to={this.props.path}
          query={query}>Any</MenuItem>
      );
  },

  getSelector() {
    return (
      <DropdownLink title={this.getCurrentLabel()}>
        {this.getDefaultItem()}
        {this.props.options.map((item) => {
          let filterQuery = {};
          filterQuery[this.props.queryKey] = item[0];
          filterQuery.cursor = '';
          let query = $.extend({}, this.props.location.query, filterQuery);
          return (
            <MenuItem
              key={item[0]}
              isActive={this.props.value === item[0]}
              to={this.props.path}
              query={query}>{item[1]}</MenuItem>
          );
        })}
      </DropdownLink>
    );
  },

  render() {
    return (
      <div className="filter-options">
        {this.props.options.length === 1 ?
          <strong>{this.getCurrentLabel()}</strong>
        :
          this.getSelector()
        }
      </div>
    );
  }
});

const SortBy = React.createClass({
  propTypes: {
    options: React.PropTypes.array.isRequired,
    path: React.PropTypes.string.isRequired,
    location: React.PropTypes.string.isRequired,
    value: React.PropTypes.any,
  },

  getCurrentSortLabel() {
    return this.props.options.filter((item) => {
      return item[0] === this.props.value;
    })[0][1];
  },

  getSortBySelector() {
    return (
      <DropdownLink title={this.getCurrentSortLabel()} className="sorted-by">
        {this.props.options.map((item) => {
          let query = $.extend({}, this.props.location.query, {
            sortBy: item[0],
            cursor: '',
          });
          return (
            <MenuItem
              isActive={this.props.value === item[0]}
              key={item[0]}
              to={this.props.path}
              query={query}>{item[1]}</MenuItem>
          );
        })}
      </DropdownLink>
    );
  },

  render() {
    if (this.props.options.length === 0)
      return null;

    return (
      <div className="sort-options">
        Showing results sorted by
        {this.props.options.length === 1 ?
          <strong className="sorted-by">{this.getCurrentSortLabel()}</strong>
        :
          this.getSortBySelector()
        }
      </div>
    );
  }
});

const ResultGrid = React.createClass({
  propTypes: {
    columns: React.PropTypes.array,
    columnsForRow: React.PropTypes.func,
    defaultSort: React.PropTypes.string,
    defaultParams: React.PropTypes.object,
    endpoint: React.PropTypes.string,
    filters: React.PropTypes.object,
    hasPagination: React.PropTypes.bool,
    hasSearch: React.PropTypes.bool,
    keyForRow: React.PropTypes.func,
    location: React.PropTypes.string,
    method: React.PropTypes.string,
    options: React.PropTypes.array,
    path: React.PropTypes.string,
    sortOptions: React.PropTypes.array,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      path: '',
      endpoint: '',
      method: 'GET',
      columns: [],
      sortOptions: [],
      filters: {},
      defaultSort: '',
      keyForRow: function(row) { return row.id; },
      columnsForRow: function(row) { return []; },
      defaultParams: {
        per_page: 50,
      },
      hasPagination: true,
      hasSearch: false,
    };
  },

  getInitialState() {
    let queryParams = (this.props.location || {}).query || {};

    return {
      rows: [],
      loading: true,
      error: false,
      pageLinks: null,
      query: queryParams.query || '',
      sortBy: queryParams.sortBy || this.props.defaultSort,
      filters: Object.assign({}, queryParams),
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    let queryParams = (nextProps.location || {}).query || {};
    this.setState({
      query: queryParams.query || '',
      sortBy: queryParams.sortBy || this.props.defaultSort,
      filters: Object.assign({}, queryParams),
      pageLinks: null,
      loading: true,
      error: false,
    }, this.fetchData);
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  refresh() {
    this.setState({
      loading: true,
    }, this.fetchData());
  },

  fetchData() {
    // TODO(dcramer): this should whitelist filters/sortBy/cursor/perPage
    let queryParams = $.extend({}, this.props.defaultParams,
      {sortBy: this.state.sortBy},
      (this.props.location || {}).query || {});

    this.api.request(this.props.endpoint, {
      method: this.props.method,
      data: queryParams,
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          rows: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      }
    });
  },

  onSearch(e) {
    let location = this.props.location || {};
    let {query} = this.state;
    let targetQueryParams = jQuery.extend({}, location.query || {}, {
      query: query,
      cursor: '',
    });

    e.preventDefault();

    browserHistory.pushState(null, this.props.path, targetQueryParams);
  },

  onQueryChange(evt) {
    this.setState({query: evt.target.value});
  },

  renderLoading() {
    return (
      <tr>
        <td colSpan={this.props.columns.length}>
          <div className="loading">
            <div className="loading-indicator" />
            <div className="loading-message">Hold on to your butts!</div>
          </div>
        </td>
      </tr>
    );
  },

  renderError() {
    return (
      <tr>
        <td colSpan={this.props.columns.length}>
          <div className="alert-block alert-error">Something bad happened :(</div>
        </td>
      </tr>
    );
  },

  renderNoResults() {
    return (
      <tr>
        <td colSpan={this.props.columns.length}>
          No results found.
        </td>
      </tr>
    );
  },

  renderResults() {
    return this.state.rows.map((row) => {
      return (
        <tr key={this.props.keyForRow(row)}>
          {this.props.columnsForRow(row)}
        </tr>
      );
    });
  },

  render() {
    let {filters} = this.props;
    return (
      <div className="result-grid">
        <div className="table-options">
          {this.props.hasSearch &&
            <div className="result-grid-search">
              <form onSubmit={this.onSearch}>
                <div className="form-group">
                  <input type="text"
                         className="form-control input-search"
                         placeholder="search"
                         style={{width: 300}}
                         name="query"
                         ref="searchInput"
                         autoComplete="off"
                         value={this.state.query}
                         onChange={this.onQueryChange} />
                  <button type="submit" className="btn btn-sm btn-primary">
                    <span className="icon-search" />
                  </button>
                </div>
              </form>
            </div>
          }
          <SortBy options={this.props.sortOptions}
                  value={this.state.sortBy}
                  path={this.props.path}
                  location={this.props.location} />
          {Object.keys(filters).map((filterKey) => {
            return (
              <Filter
                key={filterKey}
                queryKey={filterKey}
                value={this.state.filters[filterKey]}
                path={this.props.path}
                location={this.props.location}
                {...filters[filterKey]} />
              );
          })}
        </div>

        <table className="table table-grid">
          <thead>
            <tr>
              {this.props.columns}
            </tr>
          </thead>
          <tbody>
            {this.state.loading ?
              this.renderLoading()
            : (this.state.error ?
              this.renderError()
            : (this.state.rows.length === 0 ?
              this.renderNoResults()
            :
              this.renderResults()
            ))}
          </tbody>
        </table>
        {this.props.hasPagination && this.state.pageLinks &&
          <Pagination pageLinks={this.state.pageLinks}/>
        }
      </div>
    );
  }
});

export default ResultGrid;

