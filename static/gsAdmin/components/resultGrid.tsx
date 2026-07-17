import {cloneElement, Component, Fragment, isValidElement} from 'react';
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
import {Tooltip} from '@sentry/scraps/tooltip';

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
  size?: React.ComponentProps<typeof OverlayTrigger.Button>['size'];
};

function SortBy({options, path, location, value, size}: SortByProps) {
  const navigate = useNavigate();
  const {query, pathname} = location ?? {};
  const resolvedPath = path ?? pathname;

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          size={size}
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
   * Fetch the grid's data from every data region in parallel and render the
   * merged results in a single list with a Region column, instead of scoping
   * the grid to one region behind a region selector.
   *
   * A synthetic "Region" filter is rendered alongside the grid's filters;
   * selecting a region there goes back to a plain single-region fetch (with
   * pagination). The merged all-region view is not paginated: each region
   * contributes at most its first page, and the per-region result summary
   * flags regions that have more.
   *
   * This is opt-in because most regional/cell-scoped grids (e.g. invoice or
   * relocation search) have no meaningful notion of "the same record in
   * another region". Only enable it where cross-region results are useful,
   * such as customer search. Requires `isCellScoped` or `isRegional` and
   * `useQueryString` (the Region filter is URL-driven).
   *
   * @default false
   */
  allRegions?: boolean;
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
   * Unlike `allRegions`, this keeps the grid scoped to one region at a time
   * with a region selector. Prefer `allRegions` where the merged view works.
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

/**
 * Per-region progress/result summary for an all-region fetch. Rendered as a
 * chip above the table so users can see which regions are still loading, how
 * many results each one returned, and which ones failed.
 */
type RegionResult = {
  cell: Cell;
  count: number;
  /**
   * The region has more than one page of matches; only its first page is
   * included in the merged list.
   */
  hasMore: boolean;
  status: 'loading' | 'success' | 'error';
};

export type State = {
  cell: Cell | undefined;
  cursor: string;
  error: boolean;
  /**
   * Whether the current result set is being (or was) fetched from all regions
   * at once rather than only one.
   */
  fetchingAllRegions: boolean;
  filters: Location['query'];
  loading: boolean;
  pageLinks: string | null;
  /**
   * Whether we are currently probing other regions (`probeAllRegions`).
   */
  probingRegions: boolean;
  query: string;
  /**
   * Other regions that have at least one match (`probeAllRegions`).
   */
  regionMatches: Cell[];
  /**
   * Per-region status of the current all-region fetch, in region order.
   */
  regionResults: RegionResult[];
  /**
   * The region each row came from, aligned with `rows` by index. Only
   * populated for all-region fetches.
   */
  rowCells: Cell[];
  rows: any[];
  sortBy: string;
};

const extractQuery = (query: Location['query'][string], defaultVal = '') =>
  (Array.isArray(query) ? query[0] : query) ?? defaultVal;

const hasSearchQuery = (query: Location['query'][string]) =>
  extractQuery(query).trim() !== '';

const onlyRegionChanged = (prev: Location['query'], next: Location['query']) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  keys.delete('region');
  return [...keys].every(key => extractQuery(prev[key]) === extractQuery(next[key]));
};

/**
 * Regions in order of operator importance; anything unlisted sorts after
 * these, alphabetically. Drives the row, chip, and reveal order of the
 * all-region view instead of trusting the config's cell order.
 */
const REGION_PRIORITY = ['us', 'de'];

const regionPriority = (cell: Cell) => {
  const index = REGION_PRIORITY.indexOf(cell.name);
  return index === -1 ? REGION_PRIORITY.length : index;
};

const sortCellsByPriority = (cells: Cell[]) =>
  [...cells].sort(
    (a, b) => regionPriority(a) - regionPriority(b) || a.name.localeCompare(b.name)
  );

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
    allRegions: false,
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
      rowCells: [],
      fetchingAllRegions: false,
      regionResults: [],
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

    // Changing only the Region filter while an all-region search is showing
    // filters the already-fetched rows client-side — no refetch needed. Leave
    // probeToken alone so still-streaming region responses keep applying.
    if (
      this.state.fetchingAllRegions &&
      hasSearchQuery(queryParams.query) &&
      onlyRegionChanged(prevProps.location?.query ?? {}, queryParams)
    ) {
      this.setState({filters: Object.assign({}, queryParams)});
      return;
    }

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
      },
      this.fetchData
    );
  }

  /**
   * Monotonic token used to discard results from stale multi-region requests
   * (region probes and cross-region searches), e.g. when the user switches
   * regions or searches again before all regions have responded.
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

    // api.clear() aborts any in-flight multi-region requests, and aborted
    // requests never run their success/error callbacks — so their finalize()
    // would never fire and probingRegions/loading would stay stuck. Invalidate
    // them (bump the token) and clear their UI state here, the single entry
    // point for fetches, so it's reset regardless of which caller
    // (refresh/onCursor/onSearch) we hit.
    this.probeToken += 1;

    // TODO(dcramer): this should whitelist filters/sortBy/cursor/perPage
    const queryParams: Record<string, any> = {
      ...this.props.defaultParams,
      ...(this.props.useQueryString ? (this.props.location?.query ?? {}) : {}),
      sortBy: this.state.sortBy,
      cursor: this.state.cursor,
    };

    // The query lives in the URL when useQueryString is on, otherwise in
    // component state — fall back so multi-region requests always carry the
    // search term.
    const query = queryParams.query ?? this.state.query;

    const cells = getCells();
    const needsRegion = this.props.isRegional || this.props.isCellScoped;

    // The synthetic Region filter narrows an all-region grid back down to a
    // single region. It's a frontend-only concept, so it never reaches the
    // API.
    let filteredCell: Cell | undefined;
    if (this.props.allRegions) {
      const regionFilter = extractQuery(queryParams.region);
      delete queryParams.region;
      filteredCell = cells.find(c => c.name === regionFilter);
    }

    // With a search active, the Region filter is applied client-side instead
    // (see getVisibleRows) so the other regions' matches stay loaded and the
    // Region column stays visible. Without one, browsing a single region goes
    // back to a plain region-scoped fetch, which restores pagination.
    const fetchingAllRegions = Boolean(
      this.props.allRegions &&
      needsRegion &&
      cells.length > 1 &&
      (!filteredCell || hasSearchQuery(query))
    );

    this.setState({
      fetchingAllRegions,
      probingRegions: false,
      regionMatches: [],
      rows: [],
      rowCells: [],
      regionResults: [],
    });

    if (fetchingAllRegions) {
      this.fetchAllRegions({...queryParams, query}, sortCellsByPriority(cells));
      return;
    }

    const cell = filteredCell ?? this.state.cell;
    const endpoint = this.cellEndpoint(cell);

    this.props.api.request(endpoint, {
      method: this.props.method,
      host: cell ? cell.locality_url : undefined,
      data: queryParams,
      success: (data, _, resp) => {
        const rows = this.props.rowsFromData?.(data, cell) ?? data;

        this.setState({
          loading: false,
          error: false,
          rows,
          pageLinks: resp?.getResponseHeader('Link') ?? '',
        });
        if (this.props.onLoad) {
          this.props.onLoad();
        }

        // `probeAllRegions` always checks the other regions for presence, even
        // when the active region has results or no search is active. This flags
        // that the same subject (e.g. a user) also has records elsewhere.
        if (this.props.probeAllRegions) {
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
   * Fetch from every region in parallel and merge the results into a single
   * list, tagging each row with its region. Results stream in as regions
   * respond, with `regionResults` tracking per-region progress for the
   * summary chips. Regions are queried without a cursor: cross-region
   * pagination isn't supported, so each region contributes at most its first
   * page.
   */
  fetchAllRegions = (baseParams: Record<string, any>, cells: Cell[]) => {
    const token = ++this.probeToken;
    const params = {...baseParams, cursor: ''};

    const resultsByCell = new Map<
      string,
      {failed: boolean; hasMore: boolean; rows: any[]}
    >();

    const applyUpdate = () => {
      // Ignore results from a fetch that has since been superseded.
      if (token !== this.probeToken) {
        return;
      }

      const rows: any[] = [];
      const rowCells: Cell[] = [];
      const regionResults = cells.map((cell): RegionResult => {
        const result = resultsByCell.get(cell.locality_url);
        if (!result) {
          return {cell, status: 'loading', count: 0, hasMore: false};
        }
        if (result.failed) {
          return {cell, status: 'error', count: 0, hasMore: false};
        }
        rows.push(...result.rows);
        result.rows.forEach(() => rowCells.push(cell));
        return {
          cell,
          status: 'success',
          count: result.rows.length,
          hasMore: result.hasMore,
        };
      });

      const settled = resultsByCell.size === cells.length;
      this.setState({
        loading: !settled,
        // Show whatever we got as long as at least one region responded.
        error:
          settled && cells.every(cell => resultsByCell.get(cell.locality_url)?.failed),
        rows,
        rowCells,
        pageLinks: null,
        regionResults,
      });
      if (settled && this.props.onLoad) {
        this.props.onLoad();
      }
    };

    // Mark every region as loading before the first response arrives.
    applyUpdate();

    cells.forEach(cell => {
      this.props.api.request(this.cellEndpoint(cell), {
        method: this.props.method,
        host: cell.locality_url,
        data: params,
        success: (data, _, resp) => {
          const rows = this.props.rowsFromData?.(data, cell) ?? data;
          const pageLinks = resp?.getResponseHeader('Link') ?? '';
          resultsByCell.set(cell.locality_url, {
            rows: Array.isArray(rows) ? rows : [],
            hasMore: parseLinkHeader(pageLinks).next?.results === true,
            failed: false,
          });
          applyUpdate();
        },
        error: () => {
          resultsByCell.set(cell.locality_url, {rows: [], hasMore: false, failed: true});
          applyUpdate();
        },
      });
    });
  };

  /**
   * Fire a cheap (`per_page: 1`) request against every other region to find
   * out which ones have matches. Used by `probeAllRegions` grids to flag that
   * the same subject also has records elsewhere.
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

  /**
   * The rows (and their regions) to display.
   *
   * In the all-region view an active Region filter is applied here,
   * client-side, so switching it never refetches. Without a filter, rows
   * reveal in strict priority order: a region's rows only show once every
   * higher-priority region has settled, so streamed results never insert
   * above rows the operator is already reading.
   */
  getVisibleRows(): {rowCells: Cell[]; rows: any[]} {
    const {rows, rowCells, fetchingAllRegions, regionResults} = this.state;
    if (!fetchingAllRegions) {
      return {rows, rowCells};
    }

    const visible = (predicate: (cell: Cell) => boolean) => {
      const visibleRows: any[] = [];
      const visibleCells: Cell[] = [];
      rows.forEach((row, i) => {
        const cell = rowCells[i];
        if (cell && predicate(cell)) {
          visibleRows.push(row);
          visibleCells.push(cell);
        }
      });
      return {rows: visibleRows, rowCells: visibleCells};
    };

    // A filtered view is not gated on other regions — the filtered region's
    // rows show as soon as they arrive.
    const region = extractQuery(this.state.filters.region);
    if (region) {
      return visible(cell => cell.name === region);
    }

    const firstPending = regionResults.findIndex(r => r.status === 'loading');
    if (firstPending === -1) {
      return {rows, rowCells};
    }
    const revealed = new Set(
      regionResults.slice(0, firstPending).map(r => r.cell.locality_url)
    );
    return visible(cell => revealed.has(cell.locality_url));
  }

  /**
   * The effective table columns: the configured ones, plus a Region column
   * while showing merged all-region results.
   */
  getColumns() {
    return this.state.fetchingAllRegions
      ? [
          ...this.props.columns,
          <th key="region" style={{width: 100, textAlign: 'center'}}>
            Region
          </th>,
        ]
      : this.props.columns;
  }

  renderLoading() {
    return (
      <tr>
        <td colSpan={this.getColumns().length}>
          <LoadingIndicator>Hold on to your butts!</LoadingIndicator>
        </td>
      </tr>
    );
  }

  /**
   * Slim row marking where held-back region results will land while their
   * region (or a higher-priority one) is still loading.
   */
  renderPendingRegions() {
    if (!this.state.fetchingAllRegions) {
      return null;
    }
    const region = extractQuery(this.state.filters.region);
    const pending = this.state.regionResults.filter(r => r.status === 'loading');
    const relevant = region ? pending.filter(r => r.cell.name === region) : pending;
    if (relevant.length === 0) {
      return null;
    }
    return (
      <tr>
        <td colSpan={this.getColumns().length}>
          <PendingRegionNote>
            <LoadingIndicator size={14} relative style={{margin: 0}} />
            {`Searching ${relevant.map(r => r.cell.name).join(', ')}…`}
          </PendingRegionNote>
        </td>
      </tr>
    );
  }

  renderBody() {
    if (this.state.error) {
      return this.renderError();
    }
    // Revealed rows and the pending-region marker can coexist: results stream
    // in per region while lower-priority regions are still being searched.
    const hasVisibleRows = this.getVisibleRows().rows.length > 0;
    const pendingRow = this.renderPendingRegions();
    if (!hasVisibleRows && !pendingRow) {
      return this.state.loading ? this.renderLoading() : this.renderNoResults();
    }
    return (
      <Fragment>
        {hasVisibleRows && this.renderResults()}
        {pendingRow}
      </Fragment>
    );
  }

  renderError() {
    return (
      <tr>
        <td colSpan={this.getColumns().length}>
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
        <td colSpan={this.getColumns().length}>
          <EmptyMessage>No results</EmptyMessage>
        </td>
      </tr>
    );
  }

  renderRegionHint() {
    if (!this.props.probeAllRegions || this.state.loading || this.state.error) {
      return null;
    }

    if (this.state.probingRegions) {
      return <RegionHintNote>Checking other regions…</RegionHintNote>;
    }

    if (this.state.regionMatches.length === 0) {
      return null;
    }

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

  /**
   * One chip per region showing how many results it returned, a spinner while
   * it's still loading, or a failure marker — so it's always visible what the
   * merged list does and doesn't include yet.
   */
  renderRegionSummary() {
    if (!this.state.fetchingAllRegions || this.state.regionResults.length === 0) {
      return null;
    }

    return (
      <Flex align="center" gap="sm" wrap="wrap">
        {this.state.regionResults.map(({cell, status, count, hasMore}) => {
          if (status === 'loading') {
            return (
              <Tag
                key={cell.locality_url}
                variant="muted"
                icon={<LoadingIndicator size={12} relative style={{margin: 0}} />}
              >
                {cell.name}
              </Tag>
            );
          }
          if (status === 'error') {
            return (
              <Tag key={cell.locality_url} variant="danger">
                {`${cell.name}: failed`}
              </Tag>
            );
          }
          if (hasMore) {
            return (
              <Tooltip
                key={cell.locality_url}
                title={`${cell.name} has more matches than shown — refine your search to see the rest.`}
              >
                <Tag variant="warning">{`${cell.name}: ${count}+`}</Tag>
              </Tooltip>
            );
          }
          return (
            <Tag key={cell.locality_url} variant="muted">
              {`${cell.name}: ${count}`}
            </Tag>
          );
        })}
      </Flex>
    );
  }

  renderResults() {
    const columnLabels = this.getColumns().map(extractColumnLabel);
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

    const {rows, rowCells} = this.getVisibleRows();
    return rows.map((row, i) => {
      const rowRegion = this.state.fetchingAllRegions ? rowCells[i] : undefined;
      const cells = this.props.columnsForRow?.(row, rows, this.state) ?? [];
      const allCells = rowRegion
        ? [
            ...cells,
            <td key="region" style={{textAlign: 'center'}}>
              <Tag variant="info">{rowRegion.name}</Tag>
            </td>,
          ]
        : cells;
      const labeledCells = allCells.map((cell, j) => {
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
      const rowKey = this.props.keyForRow?.(row) ?? i;
      return (
        // Row keys can collide across regions (e.g. per-region auto-increment
        // ids), so scope them by region in cross-region result sets.
        <tr key={rowRegion ? `${rowRegion.name}:${rowKey}` : rowKey} style={labelVars}>
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
      hasPagination,
      hasSearch,
      inPanel,
      panelTitle,
    } = this.props;

    const columns = this.getColumns();

    const ensuredFilters = filters ?? {};
    const regionSummary = this.renderRegionSummary();

    const resultTable = (
      <TableScrollWrapper>
        <ResultTable>
          <thead>
            <tr>{columns}</tr>
          </thead>
          <tbody>{this.renderBody()}</tbody>
        </ResultTable>
      </TableScrollWrapper>
    );

    const CustomPanel = inPanel;

    const table = CustomPanel ? (
      CustomPanel === true ? (
        <Panel>
          {(panelTitle || regionSummary) && (
            <PanelHeader hasButtons={!!this.props.buttonGroup}>
              {panelTitle ?? 'Results'}
              {(regionSummary || this.props.buttonGroup) && (
                <Flex align="center" gap="md">
                  {regionSummary}
                  {this.props.buttonGroup}
                </Flex>
              )}
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
    // All-region grids trade the region selector for a Region filter, and the
    // sort control moves down next to it.
    const showAllRegionControls = Boolean(
      this.props.allRegions && needsRegion && cells.length > 1
    );

    const sortByControl = sortOptions && sortOptions.length > 0 && (
      <SortBy
        options={sortOptions ?? []}
        value={this.state.sortBy}
        path={path}
        location={location}
        size={showAllRegionControls ? 'xs' : undefined}
      />
    );

    return (
      <Container data-test-id="result-grid">
        <SortSearchForm onSubmit={this.onSearch}>
          {needsRegion && !this.props.allRegions && (
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
          {!showAllRegionControls && sortByControl}
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
        {(showAllRegionControls || Object.keys(ensuredFilters).length > 0) && (
          <FilterList>
            {showAllRegionControls && (
              <Filter
                name="Region"
                queryKey="region"
                options={sortCellsByPriority(cells).map((c): Option => [c.name, c.name])}
                value={extractQuery(this.state.filters.region)}
                path={path}
                location={location}
              />
            )}
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
            {showAllRegionControls && sortByControl && (
              <PushRight>{sortByControl}</PushRight>
            )}
          </FilterList>
        )}
        {this.renderRegionHint()}
        {CustomPanel === true
          ? null
          : regionSummary && <RegionSummaryRow>{regionSummary}</RegionSummaryRow>}
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

const RegionSummaryRow = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
`;

const PendingRegionNote = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

const PushRight = styled('div')`
  margin-left: auto;
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
