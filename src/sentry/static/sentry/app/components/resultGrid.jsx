import PropTypes from 'prop-types';
import {Component} from 'react';
import createReactClass from 'create-react-class';
import $ from 'jquery';
import {browserHistory} from 'react-router';

import withApi from 'app/utils/withApi';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import Pagination from 'app/components/pagination';
import {IconSearch} from 'app/icons';

class Filter extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    queryKey: PropTypes.string.isRequired,
    options: PropTypes.array.isRequired,
    path: PropTypes.string.isRequired,
    value: PropTypes.any,
  };

  getCurrentLabel = () => {
    const selected = this.props.options.filter(
      item => item[0] === (this.props.value || '')
    )[0];
    if (selected) {
      return this.props.name + ': ' + selected[1];
    }
    return this.props.name + ': ' + 'Any';
  };

  getDefaultItem = () => {
    const query = $.extend({}, this.props.location.query, {
      cursor: '',
    });
    delete query[this.props.queryKey];

    return (
      <MenuItem
        key=""
        isActive={this.props.value === '' || !this.props.value}
        to={{pathname: this.props.path, query}}
      >
        Any
      </MenuItem>
    );
  };

  getSelector = () => (
    <DropdownLink title={this.getCurrentLabel()}>
      {this.getDefaultItem()}
      {this.props.options.map(item => {
        const filterQuery = {};
        filterQuery[this.props.queryKey] = item[0];
        filterQuery.cursor = '';
        const query = $.extend({}, this.props.location.query, filterQuery);
        return (
          <MenuItem
            key={item[0]}
            isActive={this.props.value === item[0]}
            to={{pathname: this.props.path, query}}
          >
            {item[1]}
          </MenuItem>
        );
      })}
    </DropdownLink>
  );

  render() {
    return (
      <div className="filter-options">
        {this.props.options.length === 1 ? (
          <strong>{this.getCurrentLabel()}</strong>
        ) : (
          this.getSelector()
        )}
      </div>
    );
  }
}

class SortBy extends Component {
  static propTypes = {
    options: PropTypes.array.isRequired,
    path: PropTypes.string.isRequired,
    location: PropTypes.object,
    value: PropTypes.any,
  };

  getCurrentSortLabel = () =>
    this.props.options.filter(item => item[0] === this.props.value)[0][1];

  getSortBySelector = () => (
    <DropdownLink title={this.getCurrentSortLabel()} className="sorted-by">
      {this.props.options.map(item => {
        const query = $.extend({}, this.props.location.query, {
          sortBy: item[0],
          cursor: '',
        });
        return (
          <MenuItem
            isActive={this.props.value === item[0]}
            key={item[0]}
            to={{pathname: this.props.path, query}}
          >
            {item[1]}
          </MenuItem>
        );
      })}
    </DropdownLink>
  );

  render() {
    if (this.props.options.length === 0) {
      return null;
    }

    return (
      <div className="sort-options">
        Showing results sorted by
        {this.props.options.length === 1 ? (
          <strong className="sorted-by">{this.getCurrentSortLabel()}</strong>
        ) : (
          this.getSortBySelector()
        )}
      </div>
    );
  }
}

const ResultGrid = createReactClass({
  displayName: 'ResultGrid',

  propTypes: {
    api: PropTypes.object,
    columns: PropTypes.array,
    columnsForRow: PropTypes.func,
    defaultSort: PropTypes.string,
    defaultParams: PropTypes.object,
    endpoint: PropTypes.string,
    filters: PropTypes.object,
    hasPagination: PropTypes.bool,
    hasSearch: PropTypes.bool,
    keyForRow: PropTypes.func,
    location: PropTypes.object,
    method: PropTypes.string,
    options: PropTypes.array,
    path: PropTypes.string,
    sortOptions: PropTypes.array,
  },

  getDefaultProps() {
    return {
      path: '',
      endpoint: '',
      method: 'GET',
      columns: [],
      sortOptions: [],
      filters: {},
      defaultSort: '',
      keyForRow: function (row) {
        return row.id;
      },
      columnsForRow: function () {
        return [];
      },
      defaultParams: {
        per_page: 50,
      },
      hasPagination: true,
      hasSearch: false,
    };
  },

  getInitialState() {
    const queryParams = (this.props.location || {}).query || {};

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
    const queryParams = (nextProps.location || {}).query || {};
    this.setState(
      {
        query: queryParams.query || '',
        sortBy: queryParams.sortBy || this.props.defaultSort,
        filters: Object.assign({}, queryParams),
        pageLinks: null,
        loading: true,
        error: false,
      },
      this.fetchData
    );
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  refresh() {
    this.setState(
      {
        loading: true,
      },
      this.fetchData()
    );
  },

  fetchData() {
    // TODO(dcramer): this should explicitly allow filters/sortBy/cursor/perPage
    const queryParams = $.extend(
      {},
      this.props.defaultParams,
      {sortBy: this.state.sortBy},
      (this.props.location || {}).query || {}
    );

    this.props.api.request(this.props.endpoint, {
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
      },
    });
  },

  onSearch(e) {
    const location = this.props.location || {};
    const {query} = this.state;
    const targetQueryParams = jQuery.extend({}, location.query || {}, {
      query,
      cursor: '',
    });

    e.preventDefault();

    browserHistory.push({
      pathname: this.props.path,
      query: targetQueryParams,
    });
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
        <td colSpan={this.props.columns.length}>No results found.</td>
      </tr>
    );
  },

  renderResults() {
    return this.state.rows.map(row => (
      <tr key={this.props.keyForRow(row)}>{this.props.columnsForRow(row)}</tr>
    ));
  },

  render() {
    const {filters} = this.props;
    return (
      <div className="result-grid">
        <div className="table-options">
          {this.props.hasSearch && (
            <div className="result-grid-search">
              <form onSubmit={this.onSearch}>
                <div className="form-group">
                  <input
                    type="text"
                    className="form-control input-search"
                    placeholder="search"
                    style={{width: 300}}
                    name="query"
                    autoComplete="off"
                    value={this.state.query}
                    onChange={this.onQueryChange}
                  />
                  <button type="submit" className="btn btn-sm btn-primary">
                    <IconSearch size="xs" />
                  </button>
                </div>
              </form>
            </div>
          )}
          <SortBy
            options={this.props.sortOptions}
            value={this.state.sortBy}
            path={this.props.path}
            location={this.props.location}
          />
          {Object.keys(filters).map(filterKey => (
            <Filter
              key={filterKey}
              queryKey={filterKey}
              value={this.state.filters[filterKey]}
              path={this.props.path}
              location={this.props.location}
              {...filters[filterKey]}
            />
          ))}
        </div>

        <table className="table table-grid">
          <thead>
            <tr>{this.props.columns}</tr>
          </thead>
          <tbody>
            {this.state.loading
              ? this.renderLoading()
              : this.state.error
              ? this.renderError()
              : this.state.rows.length === 0
              ? this.renderNoResults()
              : this.renderResults()}
          </tbody>
        </table>
        {this.props.hasPagination && this.state.pageLinks && (
          <Pagination pageLinks={this.state.pageLinks} />
        )}
      </div>
    );
  },
});

export {ResultGrid};

export default withApi(ResultGrid);
