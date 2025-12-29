import {Component} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconList, IconSearch} from 'sentry/icons';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Region} from 'sentry/types/system';
import {browserHistory} from 'sentry/utils/browserHistory';
import withApi from 'sentry/utils/withApi';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import ResultTable from 'admin/components/resultTable';

type Option = [key: string, label: string];

type FilterProps = {
  name: string;
  options: Option[];
  queryKey: string;
  value: string;
  location?: Location;
  path?: string;
};

function Filter({name, queryKey, options, path, location, value}: FilterProps) {
  const {query, pathname} = location ?? {};
  const resolvedPath = path ?? pathname ?? '';

  const allOptions = [
    {value: '', label: 'Any'},
    ...options.map(item => ({value: item[0], label: item[1]})),
  ];

  const onFilter = (filter: any) => {
    const newQuery = {
      ...query,
      [queryKey]: filter,
      cursor: '', // reset cursor for pagination
    };
    browserHistory.push({pathname: resolvedPath, query: newQuery});
  };

  return (
    <CompactSelect
      triggerProps={{prefix: name, size: 'xs'}}
      value={value}
      onChange={opt => onFilter(opt.value)}
      options={allOptions}
    />
  );
}

type SortFn = (value: string, path: string, query: Location['query']) => void;

type SortByProps = {
  options: Option[];
  path: string;
  value: string;
  location?: Location;
  onSort?: SortFn;
};

const defaultOnSort: SortFn = (value, path, query) => {
  const newQuery = {
    ...query,
    sortBy: value,
    cursor: '', // reset cursor for pagination
  };
  browserHistory.push({pathname: path, query: newQuery});
};

function SortBy({options, path, location, value, onSort = defaultOnSort}: SortByProps) {
  const {query, pathname} = location ?? {};
  const resolvedPath = path ?? pathname;

  return (
    <CompactSelect
      triggerProps={{icon: <IconList size="xs" />, prefix: 'Sort By'}}
      value={value}
      onChange={opt => onSort(opt.value, resolvedPath, query ?? {})}
      options={options.map(item => ({value: item[0], label: item[1]}))}
    />
  );
}

type FilterDescriptor = {
  name: string;
  options: Option[];
};

interface ResultGridProps extends WithRouterProps {
  api: Client;
  /**
   * A list of table header column labels
   */
  columns: React.ReactNode[];
  /**
   * The API path to get the grid data from
   */
  endpoint: string;
  /**
   * The relative path to map result URLs to
   */
  path: string;
  /**
   * Button on the right side of the header
   */
  buttonGroup?: React.ReactNode;
  /**
   * Maps the row result into columns
   */
  columnsForRow?: (row: any, allRows: any[], state: State) => React.ReactNode[];
  /**
   * Additional default parameters to use when making the API requests
   */
  defaultParams?: Record<string, string | number>;
  /**
   * The default sorting to use when one hasn't been selected yet
   */
  defaultSort?: string;
  /**
   * A definition of filters
   */
  filters?: Record<string, FilterDescriptor>;
  /**
   * Should the results be paginated?
   *
   * @default true
   */
  hasPagination?: boolean;
  /**
   * Does the result grid have a search bar
   *
   * @default false
   */
  hasSearch?: boolean;
  /**
   * Wrap the table in a panel.
   *
   * If a react component is passed that component will be rendered as the
   * wrapping panel
   */
  inPanel?: boolean | React.ComponentType<{children?: React.ReactNode}>;
  /**
   * Is this a regional endpoint? If so, a region selector will be rendered
   *
   * @default false
   */
  isRegional?: boolean;
  /**
   * Get's the row key from the row
   *
   * Defaults to picking the `id` property
   */
  keyForRow?: (row: any) => string;
  /**
   * The method used when making a request to the API path
   */
  method?: 'GET' | 'POST';
  /**
   * Forwards the error message received when trying to load the data.
   */
  onError?: (res: any) => void;
  /**
   * Fires each time the API successfully updates the data. Does not forward the data itself.
   */
  onLoad?: () => void;
  /**
   * When wrapped with inPanel may be used to set the panel title
   */
  panelTitle?: string;
  /**
   * Translates the data object from the request into rows
   */
  rowsFromData?: (data: any, region: Region | undefined) => any[];
  /**
   * Allowed sorting options
   */
  sortOptions?: Option[];
  /**
   * TODO
   */
  useQueryString?: boolean;
}

export type State = {
  cursor: string;
  error: boolean;
  filters: Location['query'];
  loading: boolean;
  pageLinks: string | null;
  query: string;
  region: Region | undefined;
  rows: any[];
  sortBy: string;
};

const extractQuery = (query: Location['query'][string], defaultVal = '') =>
  (Array.isArray(query) ? query[0] : query) ?? defaultVal;

class ResultGrid extends Component<ResultGridProps, State> {
  static defaultProps: Partial<ResultGridProps> = {
    method: 'GET',
    endpoint: '',
    path: '',
    columns: [],
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
    isRegional: false,
    useQueryString: true,
  };

  constructor(props: any) {
    super(props);
    const queryParams = this.props.location?.query ?? {};
    const {cursor, query, sortBy, regionUrl} = queryParams;

    this.state = {
      rows: [],
      loading: true,
      error: false,
      pageLinks: null,
      cursor: extractQuery(cursor),
      query: extractQuery(query),
      region: this.props.isRegional
        ? regionUrl
          ? ConfigStore.get('regions').find((r: any) => r.url === extractQuery(regionUrl))
          : ConfigStore.get('regions')[0]
        : undefined,
      sortBy: extractQuery(sortBy, this.props.defaultSort),
      filters: Object.assign({}, queryParams),
    };
  }

  componentDidMount() {
    this.fetchData();

    // Remove regionalUrl after setting state
    if (this.props.isRegional && this.props.location?.query?.regionUrl) {
      browserHistory.replace({
        pathname: this.props.location.pathname,
        query: {...this.props.location.query, regionUrl: undefined},
      });
    }
  }

  componentDidUpdate(prevProps: ResultGridProps) {
    if (!this.props.useQueryString || this.props.location === prevProps.location) {
      return;
    }

    const queryParams = this.props.location?.query ?? {};
    const {cursor, query, sortBy} = queryParams;

    this.setState(
      {
        cursor: extractQuery(cursor),
        query: extractQuery(query),
        sortBy: extractQuery(sortBy, this.props.defaultSort),
        filters: Object.assign({}, queryParams),
        pageLinks: null,
        loading: true,
        error: false,
      },
      this.fetchData
    );
  }

  refresh() {
    this.setState({loading: true}, this.fetchData);
  }

  fetchData = () => {
    // Avoid slow-fetch race conditions
    this.props.api.clear();

    // TODO(dcramer): this should whitelist filters/sortBy/cursor/perPage
    const queryParams = {
      ...this.props.defaultParams,
      ...(this.props.useQueryString ? (this.props.location?.query ?? {}) : {}),
      sortBy: this.state.sortBy,
      cursor: this.state.cursor,
    };

    this.props.api.request(this.props.endpoint, {
      method: this.props.method,
      host: this.state.region ? this.state.region.url : undefined,
      data: queryParams,
      success: (data, _, resp) => {
        this.setState({
          loading: false,
          error: false,
          rows: this.props.rowsFromData?.(data, this.state.region) ?? data,
          pageLinks: resp?.getResponseHeader('Link') ?? '',
        });
        if (this.props.onLoad) {
          this.props.onLoad();
        }
      },
      error: res => {
        this.setState({
          loading: false,
          error: true,
        });
        if (this.props.onError) {
          this.props.onError(res);
        }
      },
    });
  };

  // TODO(dcramer): doesnt correctly respect filters without query strings
  onSearch = (e: React.FormEvent) => {
    const queryParams = this.props.location?.query ?? {};

    const query = {
      query: this.state.query,
      cursor: '', // reset cursor for pagination since we have a new search
    };

    e.preventDefault();

    if (this.props.useQueryString) {
      browserHistory.push({
        pathname: this.props.path,
        query: {...queryParams, ...query},
      });
    } else {
      this.setState({loading: true, ...query}, this.fetchData);
    }
  };

  onQueryChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({query: evt.target.value});
  };

  onCursor = (cursor: string | undefined) => {
    // NOTE: Sets pagination cursor and refetches data
    this.setState({cursor: cursor ?? '', loading: true}, this.fetchData);
  };

  renderLoading() {
    return (
      <tr>
        <td colSpan={this.props.columns.length}>
          <LoadingIndicator>Hold on to your butts!</LoadingIndicator>
        </td>
      </tr>
    );
  }

  renderError() {
    return (
      <tr>
        <td colSpan={this.props.columns.length}>
          <ErrorAlert type="danger" showIcon>
            Something bad happened :/
          </ErrorAlert>
        </td>
      </tr>
    );
  }

  renderNoResults() {
    return (
      <tr>
        <td colSpan={this.props.columns.length}>
          <EmptyMessage>No results</EmptyMessage>
        </td>
      </tr>
    );
  }

  renderResults() {
    return this.state.rows.map((row, i) => (
      <tr key={this.props.keyForRow?.(row) ?? i}>
        {this.props.columnsForRow?.(row, this.state.rows, this.state)}
      </tr>
    ));
  }

  render() {
    const {
      filters,
      useQueryString,
      sortOptions,
      path,
      location,
      columns,
      hasPagination,
      hasSearch,
      inPanel,
      panelTitle,
    } = this.props;

    const ensuredFilters = filters ?? {};

    const resultTable = (
      <ResultTable>
        <thead>
          <tr>{columns}</tr>
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
      </ResultTable>
    );

    const CustomPanel = inPanel;

    const table = CustomPanel ? (
      CustomPanel === true ? (
        <Panel>
          {panelTitle && (
            <PanelHeader hasButtons={!!this.props.buttonGroup}>
              {panelTitle}
              {this.props.buttonGroup}
            </PanelHeader>
          )}
          {resultTable}
        </Panel>
      ) : (
        <CustomPanel>{resultTable}</CustomPanel>
      )
    ) : (
      resultTable
    );

    return (
      <ResultGridContainer data-test-id="result-grid">
        <SortSearchForm onSubmit={this.onSearch}>
          {this.props.isRegional && (
            <CompactSelect
              triggerProps={{prefix: 'Region'}}
              value={this.state.region ? this.state.region.url : undefined}
              options={ConfigStore.get('regions').map((r: any) => ({
                label: r.name,
                value: r.url,
              }))}
              onChange={opt => {
                const region = ConfigStore.get('regions').find(
                  (r: any) => r.url === opt.value
                );
                if (region === undefined) {
                  return;
                }
                this.setState(
                  {
                    region,
                  },
                  this.fetchData
                );
              }}
            />
          )}
          {sortOptions && sortOptions.length > 0 && (
            <SortBy
              options={sortOptions ?? []}
              value={this.state.sortBy}
              path={path}
              location={location}
            />
          )}
          {hasSearch && (
            <SearchBar>
              <SearchInput
                type="text"
                placeholder="Search"
                name="query"
                autoComplete="off"
                value={this.state.query}
                onChange={this.onQueryChange}
              />
              <Button
                type="submit"
                icon={<IconSearch />}
                priority="primary"
                size="sm"
                aria-label="Search"
              />
            </SearchBar>
          )}
        </SortSearchForm>
        {Object.keys(ensuredFilters).length > 0 && (
          <FilterList>
            {Object.keys(ensuredFilters).map(filterKey => (
              <Filter
                key={filterKey}
                queryKey={filterKey}
                value={extractQuery(this.state.filters[filterKey])}
                path={path}
                location={location}
                {...ensuredFilters[filterKey]!}
              />
            ))}
          </FilterList>
        )}
        {table}
        {hasPagination && this.state.pageLinks && (
          <StyledPagination
            pageLinks={this.state.pageLinks}
            onCursor={useQueryString ? undefined : this.onCursor}
          />
        )}
      </ResultGridContainer>
    );
  }
}

const ResultGridContainer = styled('div')``;

const SortSearchForm = styled('form')`
  display: flex;
  gap: ${space(1.5)};

  &:not(:empty) {
    margin-bottom: ${space(1)};
  }

  /* Gross hack to fix z-index of dropdowns on top of each other */
  > div > button + div {
    z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu + 2};
  }
`;

const FilterList = styled('div')`
  width: 100%;
  margin-bottom: ${space(1)};
  display: flex;
  gap: ${space(0.5)};
  flex-wrap: wrap;
  align-items: center;

  /* Gross hack to fix z-index of dropdowns on top of each other */
  > div > button + div {
    z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu + 2};
  }
`;

const SearchBar = styled('div')`
  width: 100%;
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

export const SearchInput = styled(Input)`
  font-size: ${p => p.theme.fontSize.md};
  padding: ${space(0.5)} ${space(1)};
  height: 100%;

  &:focus-visible {
    box-shadow: inset 0 0 0 1px ${p => p.theme.focusBorder};
  }
`;

const StyledPagination = styled(Pagination)`
  margin-bottom: ${space(3)};
`;

const ErrorAlert = styled(Alert)`
  margin-top: ${space(0.5)};
  margin-bottom: ${space(1.5)};
`;

export default withApi(
  // TODO(TS): Type cast added as part of react 18 upgrade, can remove after?
  withSentryRouter(ResultGrid)
);
