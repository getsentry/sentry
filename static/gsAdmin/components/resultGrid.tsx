import {cloneElement, Component, isValidElement} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
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
import type {Cell} from 'sentry/types/system';
import {getCells} from 'sentry/utils/cells';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
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
   * Predicate that reports whether a returned row is an *exact* match for the
   * active search query (e.g. an org whose slug equals the searched term).
   *
   * When provided alongside `probeAcrossRegions`, the cross-region probe also
   * fires when the active region returns only fuzzy/similar matches but no
   * exact match — not just when it returns zero results. This surfaces the
   * "this org may live in another region" hint even when a similar slug is
   * returned in the current region.
   *
   * When omitted, cross-region probing falls back to the original behavior of
   * only probing when the active region returns no results at all.
   *
   * `query` is passed pre-normalized: trimmed and lower-cased. Implementations
   * should compare against an already-normalized field (e.g. an org slug, which
   * is always lower-case) and must not re-normalize the query themselves.
   */
  exactMatchQuery?: (row: any, query: string) => boolean;
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
   * When a region-scoped search returns no results, probe every other data
   * region for matches and surface a hint pointing the user to them.
   *
   * This is opt-in because most regional/cell-scoped grids (e.g. invoice or
   * relocation search) have no meaningful notion of "the same record in another
   * region". Only enable it where cross-region presence is useful, such as
   * customer search.
   *
   * @default false
   */
  probeAcrossRegions?: boolean;
  /**
   * Always probe every *other* data region for records and surface a hint when
   * any of them has matches — regardless of whether the active region has
   * results or a search query is present.
   *
   * Use this for cell-scoped detail grids that show a record's presence in the
   * currently selected region but where the same subject (e.g. a user) may also
   * belong to records in other regions. It lets an admin viewing a user's
   * organization memberships know the user also belongs to orgs in other regions
   * and that they should look there too.
   *
   * Unlike `probeAcrossRegions`, this is not search-driven: it fires on every
   * load. Prefer `probeAcrossRegions` for search grids.
   *
   * @default false
   */
  probeAllRegions?: boolean;
  /**
   * Lead text shown above the cross-region "view in" buttons when
   * `probeAllRegions` surfaces matches in other regions. Defaults to a generic
   * message; override it to give context for the specific record type.
   */
  probeAllRegionsHint?: string;
  /**
   * Translates the data object from the request into rows
   */
  rowsFromData?: (data: any, cell: Cell | undefined) => any[];
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
  cell: Cell | undefined;
  cursor: string;
  error: boolean;
  filters: Location['query'];
  loading: boolean;
  /**
   * Whether the active region returned no exact match for the current search
   * (either no results at all, or only fuzzy/similar matches). Drives whether
   * the cross-region hint should be surfaced.
   */
  missingExactMatch: boolean;
  pageLinks: string | null;
  /**
   * Whether we are currently probing other regions after a missing exact match.
   */
  probingRegions: boolean;
  query: string;
  /**
   * Other regions that have at least one match for the active search.
   */
  regionMatches: Cell[];
  rows: any[];
  sortBy: string;
};

const extractQuery = (query: Location['query'][string], defaultVal = '') =>
  (Array.isArray(query) ? query[0] : query) ?? defaultVal;

const hasSearchQuery = (query: Location['query'][string]) =>
  extractQuery(query).trim() !== '';

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
    probeAcrossRegions: false,
    probeAllRegions: false,
    useQueryString: true,
  };

  constructor(props: any) {
    super(props);
    const queryParams = this.props.location?.query ?? {};
    // In this context regionUrl == cell.locality_url
    const {cursor, query, sortBy, regionUrl} = queryParams;

    const needsRegion = this.props.isRegional || this.props.isCellScoped;
    const cells = getCells();

    this.state = {
      rows: [],
      loading: true,
      error: false,
      pageLinks: null,
      cursor: extractQuery(cursor),
      query: extractQuery(query),
      cell: needsRegion
        ? regionUrl
          ? cells.find(c => c.locality_url === extractQuery(regionUrl))
          : cells[0]
        : undefined,
      sortBy: extractQuery(sortBy, this.props.defaultSort),
      filters: Object.assign({}, queryParams),
      regionMatches: [],
      probingRegions: false,
      missingExactMatch: false,
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

    // Invalidate any in-flight region probe from the previous search.
    this.probeToken += 1;

    this.setState(
      {
        cursor: extractQuery(cursor),
        query: extractQuery(query),
        sortBy: extractQuery(sortBy, this.props.defaultSort),
        filters: Object.assign({}, queryParams),
        pageLinks: null,
        loading: true,
        error: false,
        regionMatches: [],
        probingRegions: false,
        missingExactMatch: false,
      },
      this.fetchData
    );
  }

  /**
   * Monotonic token used to discard results from stale region probes (e.g.
   * when the user switches regions or searches again before probes resolve).
   */
  probeToken = 0;

  refresh() {
    this.setState({loading: true}, this.fetchData);
  }

  // Transform endpoint to cell-scoped URL if needed
  // Currently using region.name (e.g., "us", "de") as the cell_id.
  // In the future when there's a cell selector, we would use the actual cell ID instead.
  cellEndpoint(cell: Cell | undefined) {
    return this.props.isCellScoped && cell
      ? `/_admin/cells/${cell.name}${this.props.endpoint}`
      : this.props.endpoint;
  }

  fetchData = () => {
    // Avoid slow-fetch race conditions
    this.props.api.clear();

    // api.clear() aborts any in-flight region probe, and aborted requests never
    // run their success/error callbacks — so probeOtherRegions' finalize() would
    // never fire and probingRegions would stay stuck. Invalidate the probe (bump
    // the token) and clear its UI state here, the single entry point for fetches,
    // so it's reset regardless of which caller (refresh/onCursor/onSearch) we hit.
    this.probeToken += 1;
    if (
      this.state.probingRegions ||
      this.state.regionMatches.length > 0 ||
      this.state.missingExactMatch
    ) {
      this.setState({
        probingRegions: false,
        regionMatches: [],
        missingExactMatch: false,
      });
    }

    // TODO(dcramer): this should whitelist filters/sortBy/cursor/perPage
    const queryParams: Record<string, any> = {
      ...this.props.defaultParams,
      ...(this.props.useQueryString ? (this.props.location?.query ?? {}) : {}),
      sortBy: this.state.sortBy,
      cursor: this.state.cursor,
    };

    const endpoint = this.cellEndpoint(this.state.cell);

    this.props.api.request(endpoint, {
      method: this.props.method,
      host: this.state.cell ? this.state.cell.locality_url : undefined,
      data: queryParams,
      success: (data, _, resp) => {
        const rows = this.props.rowsFromData?.(data, this.state.cell) ?? data;
        const rowsArray = Array.isArray(rows) ? rows : [];

        // The query lives in the URL when useQueryString is on, otherwise in
        // component state — fall back so probes always carry the search term.
        const query = queryParams.query ?? this.state.query;
        // Normalize once (trim + lower-case) so `exactMatchQuery` implementations
        // can compare against an already-normalized field without re-normalizing.
        const normalizedQuery = extractQuery(query).trim().toLowerCase();

        const pageLinks = resp?.getResponseHeader('Link') ?? '';
        // We can only conclude that a region lacks an exact match when we're
        // looking at its *complete* result set: the first page with no further
        // pages. If results span multiple pages the exact slug could live on a
        // page we haven't loaded, which would both produce a misleading "No
        // exact match" hint and make the hint vanish the moment the user
        // paginates. An empty result is naturally a complete set.
        const isFirstPage = !extractQuery(queryParams.cursor);
        const hasNextPage = parseLinkHeader(pageLinks).next?.results === true;
        const isCompleteResultSet = isFirstPage && !hasNextPage;

        // Probe other regions whenever the active region lacks an *exact* match
        // for the search. With an `exactMatchQuery` predicate this includes the
        // case where the region returns only fuzzy/similar matches (e.g. a
        // look-alike org slug) but not the exact slug searched. Without the
        // predicate we fall back to probing only on a completely empty result.
        const isEmpty = rowsArray.length === 0;
        const missingExactMatch = Boolean(
          this.props.probeAcrossRegions &&
          isCompleteResultSet &&
          hasSearchQuery(query) &&
          (this.props.exactMatchQuery
            ? !rowsArray.some(row => this.props.exactMatchQuery!(row, normalizedQuery))
            : isEmpty)
        );

        this.setState({
          loading: false,
          error: false,
          rows,
          pageLinks,
          regionMatches: [],
          missingExactMatch,
        });
        if (this.props.onLoad) {
          this.props.onLoad();
        }

        // `probeAllRegions` always checks the other regions for presence, even
        // when the active region has results or no search is active. This flags
        // that the same subject (e.g. a user) also has records elsewhere.
        if (missingExactMatch || this.props.probeAllRegions) {
          this.probeOtherRegions({...queryParams, query});
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

  /**
   * Fire a cheap (`per_page: 1`) search against every other region to find out
   * which ones have matches for the current query. Runs only after the active
   * region returns no results, so there is no cost on the common path.
   */
  probeOtherRegions = (baseParams: Record<string, any>) => {
    const currentCell = this.state.cell;
    const otherCells = getCells().filter(
      c => c.locality_url !== currentCell?.locality_url
    );
    if (otherCells.length === 0) {
      return;
    }

    const token = ++this.probeToken;
    this.setState({probingRegions: true, regionMatches: []});

    // per_page: 1 — we only need to know whether the region has any match, not
    // how many. The admin customers endpoint doesn't return an X-Hits total, so
    // we deliberately surface presence only rather than an unreliable count.
    const probeParams = {...baseParams, cursor: '', per_page: 1};
    const matches: Cell[] = [];
    let remaining = otherCells.length;

    const finalize = () => {
      remaining -= 1;
      // Ignore results from a probe that has since been superseded.
      if (remaining > 0 || token !== this.probeToken) {
        return;
      }
      matches.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({probingRegions: false, regionMatches: matches});
    };

    otherCells.forEach(cell => {
      this.props.api.request(this.cellEndpoint(cell), {
        method: this.props.method,
        host: cell.locality_url,
        data: probeParams,
        success: (data, _, _resp) => {
          const rows = this.props.rowsFromData?.(data, cell) ?? data;
          if (Array.isArray(rows) && rows.length > 0) {
            matches.push(cell);
          }
          finalize();
        },
        error: () => finalize(),
      });
    });
  };

  onChangeCell = (localityUrl: string | undefined) => {
    const cell = getCells().find(c => c.locality_url === localityUrl);
    if (cell === undefined) {
      return;
    }
    // Invalidate any in-flight probe before switching regions.
    this.probeToken += 1;
    this.setState(
      {cell, loading: true, regionMatches: [], probingRegions: false},
      this.fetchData
    );
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

  renderRegionHint() {
    const {probeAcrossRegions, probeAllRegions} = this.props;

    if (
      (!probeAcrossRegions && !probeAllRegions) ||
      this.state.loading ||
      this.state.error
    ) {
      return null;
    }

    // The search-driven hint only surfaces when the active region lacked an
    // exact match. The always-on `probeAllRegions` hint has no such gate.
    if (!probeAllRegions && !this.state.missingExactMatch) {
      return null;
    }

    if (this.state.probingRegions) {
      return <RegionHintNote>Checking other regions…</RegionHintNote>;
    }

    if (this.state.regionMatches.length === 0) {
      return null;
    }

    if (probeAllRegions) {
      const lead =
        this.props.probeAllRegionsHint ??
        'Also found in other data regions — look there too:';
      return (
        <RegionHintAlert variant="info" showIcon>
          <Flex align="center" gap="md" wrap="wrap">
            <span>{lead}</span>
            {this.state.regionMatches.map(cell => (
              <Button
                key={cell.locality_url}
                size="xs"
                onClick={() => this.onChangeCell(cell.locality_url)}
              >
                {`View in ${cell.name}`}
              </Button>
            ))}
          </Flex>
        </RegionHintAlert>
      );
    }

    const currentName = this.state.cell?.name ?? 'this region';
    // The active region returned similar (but not exact) matches — make it
    // clear the exact record was not found here, rather than implying no
    // results at all.
    const leadText = this.state.rows.length > 0 ? 'No exact match in' : 'No results in';

    return (
      <RegionHintAlert variant="info" showIcon>
        <Flex align="center" gap="md" wrap="wrap">
          <span>
            {leadText} <strong>{currentName}</strong>. Found results in another data
            region:
          </span>
          {this.state.regionMatches.map(cell => (
            <Button
              key={cell.locality_url}
              size="xs"
              onClick={() => this.onChangeCell(cell.locality_url)}
            >
              {`View in ${cell.name}`}
            </Button>
          ))}
        </Flex>
      </RegionHintAlert>
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

    const cells = getCells();
    const needsRegion = this.props.isRegional || this.props.isCellScoped;

    return (
      <Container data-test-id="result-grid">
        <SortSearchForm onSubmit={this.onSearch}>
          {needsRegion && (
            <CompactSelect
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} prefix="Region" />
              )}
              value={this.state.cell ? this.state.cell.locality_url : undefined}
              options={cells.map(c => {
                const hasMatch = this.state.regionMatches.some(
                  m => m.locality_url === c.locality_url
                );
                return {
                  label: c.name,
                  value: c.locality_url,
                  trailingItems: hasMatch ? (
                    <Tag variant="success">found</Tag>
                  ) : undefined,
                };
              })}
              onChange={opt => this.onChangeCell(opt.value)}
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
        {this.renderRegionHint()}
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

const RegionHintAlert = styled(Alert)`
  margin-bottom: ${p => p.theme.space.md};
`;

const RegionHintNote = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
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
