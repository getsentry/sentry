import {Component} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {Client, RequestOptions} from 'sentry/api';
import DropdownLink from 'sentry/components/dropdownLink';
import MenuItem from 'sentry/components/menuItem';
import Pagination from 'sentry/components/pagination';
import {IconSearch} from 'sentry/icons';
import withApi from 'sentry/utils/withApi';

type Option = [value: string, label: string];

type FilterProps = {
  location: Location;
  name: string;
  options: Option[];
  path: string;
  queryKey: string;
  value: string;
};

class Filter extends Component<FilterProps> {
  getCurrentLabel() {
    const selected = this.props.options.find(
      item => item[0] === (this.props.value ?? '')
    );
    if (selected) {
      return this.props.name + ': ' + selected[1];
    }
    return this.props.name + ': ' + 'Any';
  }

  getDefaultItem() {
    const query = {...this.props.location.query, cursor: ''};
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
  }

  getSelector = () => (
    <DropdownLink title={this.getCurrentLabel()}>
      {this.getDefaultItem()}
      {this.props.options.map(([value, label]) => {
        const filterQuery = {
          [this.props.queryKey]: value,
          cursor: '',
        };

        const query = {...this.props.location.query, ...filterQuery};
        return (
          <MenuItem
            key={value}
            isActive={this.props.value === value}
            to={{pathname: this.props.path, query}}
          >
            {label}
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

type SortByProps = {
  location: Location;
  options: Option[];
  path: string;
  value: string;
};

class SortBy extends Component<SortByProps> {
  getCurrentSortLabel() {
    return this.props.options.find(([value]) => value === this.props.value)?.[1];
  }

  getSortBySelector() {
    return (
      <DropdownLink title={this.getCurrentSortLabel()} className="sorted-by">
        {this.props.options.map(([value, label]) => {
          const query = {...this.props.location.query, sortBy: value, cursor: ''};
          return (
            <MenuItem
              isActive={this.props.value === value}
              key={value}
              to={{pathname: this.props.path, query}}
            >
              {label}
            </MenuItem>
          );
        })}
      </DropdownLink>
    );
  }

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

type FilterConfig = {
  name: string;
  options: Option[];
};

// XXX(ts): Using Partial here on the DefaultProps is not really correct, since
// defaultProps guarantees they'll be set. But because this component is
// wrapped with a HoC, we lose the defaultProps, and users of the component
type Props = {
  api: Client;
  location: Location;
} & Partial<DefaultProps>;

type DefaultProps = {
  columns: React.ReactNode[];
  columnsForRow: (row: any) => React.ReactNode[];
  defaultParams: Record<string, any>;
  defaultSort: string;
  endpoint: string;
  filters: Record<string, FilterConfig>;
  hasPagination: boolean;
  hasSearch: boolean;
  keyForRow: (row: any) => string;
  method: RequestOptions['method'];
  path: string;
  sortOptions: Option[];
};

type State = {
  error: string | boolean;
  filters: Record<string, string>;
  loading: boolean;
  pageLinks: null | string;
  query: string;
  rows: any[];
  sortBy: string;
};

class ResultGrid extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    path: '',
    endpoint: '',
    method: 'GET',
    columns: [],
    sortOptions: [],
    filters: {},
    defaultSort: '',
    keyForRow: row => row.id,
    columnsForRow: () => [],
    defaultParams: {
      per_page: 50,
    },
    hasPagination: true,
    hasSearch: false,
  };

  state: State = this.defaultState;

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps() {
    const queryParams = this.query;
    this.setState(
      {
        query: queryParams.query ?? '',
        sortBy: queryParams.sortBy ?? this.props.defaultSort,
        filters: {...queryParams},
        pageLinks: null,
        loading: true,
        error: false,
      },
      this.fetchData
    );
  }

  get defaultState() {
    const queryParams = this.query;

    return {
      rows: [],
      loading: true,
      error: false,
      pageLinks: null,
      query: queryParams.query ?? '',
      sortBy: queryParams.sortBy ?? this.props.defaultSort,
      filters: {...queryParams},
    } as State;
  }

  get query() {
    return ((this.props.location ?? {}).query ?? {}) as {[k: string]: string};
  }

  remountComponent() {
    this.setState(this.defaultState, this.fetchData);
  }

  refresh() {
    this.setState({loading: true}, this.fetchData);
  }

  fetchData() {
    // TODO(dcramer): this should explicitly allow filters/sortBy/cursor/perPage
    const queryParams = {
      ...this.props.defaultParams,
      sortBy: this.state.sortBy,
      ...this.query,
    };

    this.props.api.request(this.props.endpoint!, {
      method: this.props.method,
      data: queryParams,
      success: (data, _, resp) => {
        this.setState({
          loading: false,
          error: false,
          rows: data,
          pageLinks: resp?.getResponseHeader('Link') ?? null,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  }

  onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    const location = this.props.location ?? {};
    const {query} = this.state;
    const targetQueryParams = {...(location.query ?? {}), query, cursor: ''};

    e.preventDefault();

    browserHistory.push({
      pathname: this.props.path,
      query: targetQueryParams,
    });
  };

  onQueryChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({query: evt.target.value});
  };

  renderLoading() {
    return (
      <tr>
        <td colSpan={this.props.columns!.length}>
          <div className="loading">
            <div className="loading-indicator" />
            <div className="loading-message">Hold on to your butts!</div>
          </div>
        </td>
      </tr>
    );
  }

  renderError() {
    return (
      <tr>
        <td colSpan={this.props.columns!.length}>
          <div className="alert-block alert-error">Something bad happened :(</div>
        </td>
      </tr>
    );
  }

  renderNoResults() {
    return (
      <tr>
        <td colSpan={this.props.columns!.length}>No results found.</td>
      </tr>
    );
  }

  renderResults() {
    return this.state.rows.map(row => (
      <tr key={this.props.keyForRow?.(row)}>{this.props.columnsForRow?.(row)}</tr>
    ));
  }

  render() {
    const {filters, sortOptions, path, location} = this.props;
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
            options={sortOptions ?? []}
            value={this.state.sortBy}
            path={path ?? ''}
            location={location}
          />
          {Object.keys(filters ?? {}).map(filterKey => (
            <Filter
              key={filterKey}
              queryKey={filterKey}
              value={this.state.filters[filterKey]}
              path={path ?? ''}
              location={location}
              {...(filters?.[filterKey] as FilterConfig)}
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
  }
}

export {ResultGrid};

export default withApi(ResultGrid);
