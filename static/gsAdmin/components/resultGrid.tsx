import {cloneElement, Component, isValidElement} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';

import type {Client} from 'sentry/api';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {IconList, IconSearch} from 'sentry/icons';
import type {Region} from 'sentry/types/system';
import {getRegions} from 'sentry/utils/regions';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useNavigate} from 'sentry/utils/useNavigate';

import {ResultTable} from 'admin/components/resultTable';

type Option = [key: string, label: string];

function extractColumnLabel(col: React.ReactNode): string {
  if (!isValidElement(col)) {
    return '';
  }
  const {children} = col.props as {children?: React.ReactNode};
  if (typeof children === 'string') {
    return children.trim();
  }
  if (Array.isArray(children)) {
    return children
      .filter((c: unknown): c is string => typeof c === 'string')
      .join(' ')
      .trim();
  }
  return '';
}

type FilterProps = {
  name: string;
  options: Option[];
  queryKey: string;
  value: string;
  location?: Location;
  path?: string;
};

function Filter({name, queryKey, options, path, location, value}: FilterProps) {
  const navigate = useNavigate();
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
    navigate({pathname: resolvedPath, query: newQuery});
  };

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={name} size="xs" />
      )}
      value={value}
      onChange={opt => onFilter(opt.value)}
      options={allOptions}
    />
  );
}

type SortByProps = {
  options: Option[];
  path: string;
  value: string;
  location?: Location;
};

function SortBy({options, path, location, value}: SortByProps) {
  const navigate = useNavigate();
  const {query, pathname} = location ?? {};
  const resolvedPath = path ?? pathname;

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          icon={<IconList size="xs" />}
          prefix="Sort By"
        />
      )}
      value={value}
      onChange={opt =>
        navigate({
          pathname: resolvedPath,
          query: {...query, sortBy: opt.value, cursor: ''},
        })
      }
      options={options.map(item => ({value: item[0], label: item[1]}))}
    />
  );
}

type FilterDescriptor = {
  name: string;
  options: Option[];
};

interface ResultGridProps {
  api: Client;
  /**
   * A list of table header column labels
   */
  columns: React.ReactNode[];
  /**
   * The API path to get the grid data from
   */
  endpoint: string;
  location: Location;
  navigate: ReactRouter3Navigate;
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
   * Is this endpoint cell-scoped? If true, the endpoint URL will be transformed
   * to include /_admin/cells/${cell_id}/ prefix.
   *
   * @default false
   */
  isCellScoped?: boolean;
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

class ResultGridImpl extends Component<ResultGridProps, State> {
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
    isCellScoped: false,
    isRegional: false,
    useQueryString: true,
  };

  constructor(props: any) {
    super(props);
    const queryParams = this.props.location?.query ?? {};
    const {cursor, query, sortBy, regionUrl} = queryParams;

    const needsRegion = this.props.isRegional || this.props.isCellScoped;
    // TODO(cells) We need cells here
    const regions = getRegions();

    this.state = {
      rows: [],
      loading: true,
      error: false,
      pageLinks: null,
      cursor: extractQuery(cursor),
      query: extractQuery(query),
      region: needsRegion
        ? regionUrl
          ? regions.find((r: any) => r.url === extractQuery(regionUrl))
          : regions[0]
        : undefined,
      sortBy: extractQuery(sortBy, this.props.defaultSort),
      filters: Object.assign({}, queryParams),
    };
  }

  componentDidMount() {
    this.fetchData();

    // Remove regionalUrl after setting state
    const needsRegion = this.props.isRegional || this.props.isCellScoped;
    if (needsRegion && this.props.location?.query?.regionUrl) {
      this.props.navigate(
        {
          pathname: this.props.location.pathname,
          query: {...this.props.location.query, regionUrl: undefined},
        },
        {replace: true}
      );
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

    // Transform endpoint to cell-scoped URL if needed
    // Currently using region.name (e.g., "us", "de") as the cell_id.
    // In the future when there's a cell selector, we would use the actual cell ID instead.
    const endpoint =
      this.props.isCellScoped && this.state.region
        ? `/_admin/cells/${this.state.region.name}${this.props.endpoint}`
        : this.props.endpoint;

    this.props.api.request(endpoint, {
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
      this.props.navigate({
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
          <ErrorAlert variant="danger" showIcon>
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
    const columnLabels = this.props.columns.map(extractColumnLabel);
    const firstPrimaryIndex = columnLabels.findIndex(label => (label ?? '') !== '');

    // CSS custom properties on <tr> carry column labels to ::before pseudo-elements
    // via inheritance, which works even when cells are rendered inside wrapper components
    // (where cloneElement can't reach the inner <td> elements).
    const labelVars = Object.fromEntries(
      columnLabels.map((label, j) => [
        `--cl-${j + 1}`,
        `"${(label ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
      ])
    );

    return this.state.rows.map((row, i) => {
      const cells = this.props.columnsForRow?.(row, this.state.rows, this.state) ?? [];
      const labeledCells = cells.map((cell, j) => {
        if (!isValidElement(cell)) {
          return cell;
        }
        const extraProps: Record<string, unknown> = {'data-label': columnLabels[j] ?? ''};
        if (j === firstPrimaryIndex) {
          extraProps['data-mobile-primary'] = 'true';
        }
        return cloneElement(
          cell as React.ReactElement<Record<string, unknown>>,
          extraProps
        );
      });
      return (
        <tr key={this.props.keyForRow?.(row) ?? i} style={labelVars}>
          {labeledCells}
        </tr>
      );
    });
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
      <TableScrollWrapper>
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
      </TableScrollWrapper>
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

    // TODO(cells) We need cells here.
    const regions = getRegions();
    const needsRegion = this.props.isRegional || this.props.isCellScoped;

    return (
      <Container data-test-id="result-grid">
        <SortSearchForm onSubmit={this.onSearch}>
          {needsRegion && (
            <CompactSelect
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} prefix="Region" />
              )}
              value={this.state.region ? this.state.region.url : undefined}
              options={regions.map((r: any) => ({
                label: r.name,
                value: r.url,
              }))}
              onChange={opt => {
                const region = regions.find((r: any) => r.url === opt.value);
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
            <Flex align="center" gap="xs" width="100%">
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
                variant="primary"
                size="sm"
                aria-label="Search"
              />
            </Flex>
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
      </Container>
    );
  }
}

const TableScrollWrapper = styled(Container)`
  overflow-x: auto;

  @media (max-width: 768px) {
    overflow-x: visible;
  }
`;

const SortSearchForm = styled('form')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.lg};

  &:not(:empty) {
    margin-bottom: ${p => p.theme.space.md};
  }

  /* Gross hack to fix z-index of dropdowns on top of each other */
  > div > button + div {
    z-index: ${p => p.theme.zIndex.dropdown + 2};
  }
`;

const FilterList = styled('div')`
  width: 100%;
  margin-bottom: ${p => p.theme.space.md};
  display: flex;
  gap: ${p => p.theme.space.xs};
  flex-wrap: wrap;
  align-items: center;

  /* Gross hack to fix z-index of dropdowns on top of each other */
  > div > button + div {
    z-index: ${p => p.theme.zIndex.dropdown + 2};
  }
`;

export const SearchInput = styled(Input)`
  font-size: ${p => p.theme.font.size.md};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  height: 100%;

  &:focus-visible {
    box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.focus.default};
  }
`;

const StyledPagination = styled(Pagination)`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const ErrorAlert = styled(Alert)`
  margin-top: ${p => p.theme.space.xs};
  margin-bottom: ${p => p.theme.space.lg};
`;

type ResultGridWrapperProps = Omit<ResultGridProps, 'api' | 'location' | 'navigate'> & {
  api?: Client;
};

export function ResultGrid({api, ...props}: ResultGridWrapperProps) {
  const defaultApi = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ResultGridImpl
      {...props}
      api={api ?? defaultApi}
      location={location}
      navigate={navigate}
    />
  );
}
