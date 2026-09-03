import {cloneElement, Component, Fragment, isValidElement} from 'react';
import {keyframes} from '@emotion/react';
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
import {IconList, IconSearch, IconWarning} from 'sentry/icons';
import type {Cell} from 'sentry/types/system';
import {getCells} from 'sentry/utils/cells';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useNavigate} from 'sentry/utils/useNavigate';

import {ResultTable} from 'admin/components/resultTable';

type Option = [key: string, label: string];

/**
 * Sentinel region-selector value that means "query every region at once".
 * Locality URLs are always full URLs, so this cannot collide with one.
 */
const ALL_REGIONS = 'all';

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
        <OverlayTrigger.Button {...triggerProps} prefix={name} size="sm" />
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
          size="sm"
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
   * Adds an "All regions" option to the region selector — selected by default —
   * that queries every region in parallel and merges the results into a single
   * table with a Region column (placed by `regionColumnIndex`). Rows appear as
   * each region responds.
   *
   * Cursors do not compose across regions, so this mode holds one cursor per
   * region and grows the table by a page from each of them, through a "Load
   * more" control in place of the single-cursor pagination. Provide
   * `sortValueForRow` so the merged rows keep a coherent order as pages
   * arrive.
   *
   * Only meaningful together with `isRegional`/`isCellScoped`.
   *
   * @default false
   */
  allowAllRegions?: boolean;
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
   * Index in `columns` where the all-regions Region column is inserted.
   *
   * @default 0
   */
  regionColumnIndex?: number;
  /**
   * Translates the data object from the request into rows
   */
  rowsFromData?: (data: any, cell: Cell | undefined) => any[];
  /**
   * Allowed sorting options
   */
  sortOptions?: Option[];
  /**
   * Returns the numeric sort value of a row for the given `sortBy` key, used
   * to keep the merged all-regions table sorted client-side (descending, to
   * match the server's ordering). Each region's page is already server-sorted;
   * this lets the merged view interleave them correctly as responses arrive.
   *
   * Only used in the `allowAllRegions` mode.
   */
  sortValueForRow?: (row: any, sortBy: string) => number;
  /**
   * TODO
   */
  useQueryString?: boolean;
}

export type State = {
  /**
   * Whether the grid is in the all-regions mode: every region is queried in
   * parallel and the results are merged. `cell` is undefined while active.
   */
  allRegions: boolean;
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
   * Names of regions whose all-regions request is still in flight.
   */
  pendingRegions: string[];
  /**
   * Whether we are currently probing other regions after a missing exact match.
   */
  probingRegions: boolean;
  query: string;
  /**
   * The cursor of the next page of every region that still has one, keyed by
   * cell name. A region leaves the map when it runs out of pages, so an empty
   * map means the merged table holds every result.
   */
  regionCursors: Record<string, string>;
  /**
   * Names of regions whose all-regions request failed.
   */
  regionErrors: string[];
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
    allowAllRegions: false,
    probeAcrossRegions: false,
    probeAllRegions: false,
    useQueryString: true,
  };

  constructor(props: any) {
    super(props);
    const locationQuery = this.props.location?.query ?? {};
    // An isolated grid (useQueryString off) owns its query state. Params that
    // another grid on the same page wrote to the URL must not leak into it.
    const queryParams = this.props.useQueryString ? locationQuery : {};
    const {cursor, query, sortBy} = queryParams;
    // In this context regionUrl == cell.locality_url. Region selection stays
    // URL-driven for every grid: links use it to open a page in a region.
    const {regionUrl} = locationQuery;

    const needsRegion = this.props.isRegional || this.props.isCellScoped;
    const cells = getCells();

    const requestedCell = regionUrl
      ? cells.find(c => c.locality_url === extractQuery(regionUrl))
      : undefined;
    const allRegions = Boolean(
      needsRegion && this.props.allowAllRegions && !requestedCell
    );

    this.state = {
      rows: [],
      loading: true,
      error: false,
      pageLinks: null,
      cursor: extractQuery(cursor),
      query: extractQuery(query),
      allRegions,
      cell: needsRegion && !allRegions ? (requestedCell ?? cells[0]) : undefined,
      sortBy: extractQuery(sortBy, this.props.defaultSort),
      filters: Object.assign({}, queryParams),
      regionMatches: [],
      probingRegions: false,
      missingExactMatch: false,
      pendingRegions: [],
      regionErrors: [],
      regionCursors: {},
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
        pendingRegions: [],
        regionErrors: [],
        regionCursors: {},
      },
      this.fetchData
    );
  }

  /**
   * Monotonic token used to discard results from stale region probes (e.g.
   * when the user switches regions or searches again before probes resolve).
   */
  probeToken = 0;

  /**
   * Monotonic token used to discard responses from a superseded all-regions
   * fetch (e.g. the user changed the sort or region while regions were still
   * responding).
   */
  fetchToken = 0;

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

  /**
   * The request parameters for the current search, sort and filters.
   *
   * The cursor here is the grid's own; the all-regions view overrides it with
   * the cursor of the region it is asking.
   */
  // TODO(dcramer): this should whitelist filters/sortBy/cursor/perPage
  buildQueryParams(): Record<string, any> {
    return {
      ...this.props.defaultParams,
      ...(this.props.useQueryString
        ? (this.props.location?.query ?? {})
        : this.state.query
          ? {query: this.state.query}
          : {}),
      sortBy: this.state.sortBy,
      cursor: this.state.cursor,
    };
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
    this.fetchToken += 1;
    if (
      this.state.probingRegions ||
      this.state.regionMatches.length > 0 ||
      this.state.missingExactMatch ||
      this.state.pendingRegions.length > 0 ||
      this.state.regionErrors.length > 0 ||
      Object.keys(this.state.regionCursors).length > 0
    ) {
      this.setState({
        probingRegions: false,
        regionMatches: [],
        missingExactMatch: false,
        pendingRegions: [],
        regionErrors: [],
        regionCursors: {},
      });
    }

    const queryParams = this.buildQueryParams();

    if (this.state.allRegions) {
      this.fetchAllRegions(queryParams);
      return;
    }

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
   * Re-sort merged all-regions rows with `sortValueForRow`, descending to
   * match the server's ordering. Without the prop, rows keep arrival order.
   */
  sortRows(rows: any[]) {
    const {sortValueForRow} = this.props;
    if (!sortValueForRow) {
      return rows;
    }
    const {sortBy} = this.state;
    return rows.toSorted(
      (a, b) => sortValueForRow(b, sortBy) - sortValueForRow(a, sortBy)
    );
  }

  /**
   * Query every region in parallel and merge the results into one table. Each
   * region's rows are tagged with their cell (rendered as the Region column)
   * and the merged set is re-sorted as every response arrives, so the table
   * stays coherently ordered while regions trickle in.
   */
  fetchAllRegions = (queryParams: Record<string, any>) => {
    const cells = getCells();

    if (cells.length === 0) {
      this.setState({loading: false, error: false, rows: [], pageLinks: null});
      return;
    }

    this.setState({
      loading: false,
      error: false,
      rows: [],
      pageLinks: null,
      pendingRegions: cells.map(c => c.name),
      regionErrors: [],
      regionCursors: {},
    });

    this.fetchRegionPages(
      cells.map(cell => ({cell, cursor: ''})),
      queryParams
    );
  };

  /**
   * Load the next page of every region that still has one and append it to the
   * merged table. A merged view has no cursor of its own — cursors do not
   * compose across regions — so it grows a page per region at a time.
   */
  loadMoreRegions = () => {
    const {regionCursors} = this.state;
    const pages = getCells()
      .filter(cell => regionCursors[cell.name])
      .map(cell => ({cell, cursor: regionCursors[cell.name]!}));

    if (pages.length === 0) {
      return;
    }

    const names = pages.map(page => page.cell.name);
    // A region that failed keeps its warning unless this load asks it again —
    // it holds no cursor, so nothing here retries it, and its results are
    // still missing from the table.
    this.setState(prev => ({
      pendingRegions: names,
      regionErrors: prev.regionErrors.filter(name => !names.includes(name)),
    }));
    this.fetchRegionPages(pages, this.buildQueryParams());
  };

  /**
   * Request one page from each given region, merge the rows into the table and
   * record the cursor of any region that reports a further page.
   */
  fetchRegionPages = (
    pages: Array<{cell: Cell; cursor: string}>,
    queryParams: Record<string, any>
  ) => {
    const token = this.fetchToken;
    const names = pages.map(({cell}) => cell.name);

    pages.forEach(({cell, cursor}) => {
      const markFailed = () => {
        if (token !== this.fetchToken) {
          return;
        }
        this.setState(prev => {
          if (!prev.pendingRegions.includes(cell.name)) {
            return null;
          }
          const regionErrors = [...prev.regionErrors, cell.name];
          return {
            // Every region of this load failing with nothing to show is a
            // failed load. A region failing under rows we already have is a
            // partial result, so keep the table.
            error:
              prev.rows.length === 0 && names.every(name => regionErrors.includes(name)),
            pendingRegions: prev.pendingRegions.filter(name => name !== cell.name),
            regionErrors,
          };
        });
      };

      const request = this.props.api.request(this.cellEndpoint(cell), {
        method: this.props.method,
        host: cell.locality_url,
        data: {...queryParams, cursor},
        success: (data, _, resp) => {
          if (token !== this.fetchToken) {
            return;
          }
          const rows = this.props.rowsFromData?.(data, cell) ?? data;
          const tagged = (Array.isArray(rows) ? rows : []).map(row => ({
            ...row,
            __region: cell,
          }));
          const next = parseLinkHeader(resp?.getResponseHeader('Link') ?? '').next;
          const nextCursor = next?.results === true ? (next.cursor ?? '') : '';

          this.setState(prev => {
            if (!prev.pendingRegions.includes(cell.name)) {
              return null;
            }
            const regionCursors = {...prev.regionCursors};
            if (nextCursor) {
              regionCursors[cell.name] = nextCursor;
            } else {
              delete regionCursors[cell.name];
            }
            return {
              rows: this.sortRows([...prev.rows, ...tagged]),
              pendingRegions: prev.pendingRegions.filter(name => name !== cell.name),
              regionCursors,
            };
          });
          this.props.onLoad?.();
        },
        error: res => {
          markFailed();
          if (this.props.onError) {
            this.props.onError(res);
          }
        },
      });

      // The API client swallows a rejection of the fetch itself (a blocked
      // request, a network failure) without running either callback, which
      // would leave the region pending forever. Catch it here so the region
      // resolves to failed. An abort from api.clear() also lands here, but
      // the fetch token was already bumped by then, so markFailed ignores it.
      request?.requestPromise?.catch(markFailed);
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
    // Invalidate any in-flight probe before switching regions.
    this.probeToken += 1;

    if (localityUrl === ALL_REGIONS) {
      this.setState(
        {
          allRegions: true,
          cell: undefined,
          loading: true,
          rows: [],
          regionMatches: [],
          probingRegions: false,
        },
        this.fetchData
      );
      return;
    }

    const cell = getCells().find(c => c.locality_url === localityUrl);
    if (cell === undefined) {
      return;
    }
    this.setState(
      {
        allRegions: false,
        cell,
        loading: true,
        pendingRegions: [],
        regionErrors: [],
        regionMatches: [],
        probingRegions: false,
      },
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
   * Where the Region column sits in the all-regions mode, clamped to the
   * column list.
   */
  clampedRegionIndex() {
    const {columns, regionColumnIndex} = this.props;
    return Math.min(Math.max(regionColumnIndex ?? 0, 0), columns.length);
  }

  /**
   * The table columns, with the Region column inserted in the all-regions mode.
   */
  effectiveColumns() {
    if (!this.state.allRegions) {
      return this.props.columns;
    }
    return this.props.columns.toSpliced(
      this.clampedRegionIndex(),
      0,
      <th key="__region" style={{width: 70}}>
        Region
      </th>
    );
  }

  renderLoading() {
    return (
      <tr>
        <td colSpan={this.effectiveColumns().length}>
          <LoadingIndicator>Hold on to your butts!</LoadingIndicator>
        </td>
      </tr>
    );
  }

  renderError() {
    return (
      <tr>
        <td colSpan={this.effectiveColumns().length}>
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
        <td colSpan={this.effectiveColumns().length}>
          <EmptyMessage>No results</EmptyMessage>
        </td>
      </tr>
    );
  }

  /**
   * The all-regions table body. Rows render as regions respond. The "still
   * updating" signal lives outside the body: an indeterminate bar on top of
   * the table plus the pending-regions note in the selector row, so rows
   * never shift while regions trickle in. "No results" only shows once every
   * region has answered.
   */
  renderAllRegionsBody() {
    const {loading, pendingRegions, rows} = this.state;
    if (rows.length > 0) {
      return this.renderResults();
    }
    if (loading || pendingRegions.length > 0) {
      return this.renderLoading();
    }
    return this.renderNoResults();
  }

  renderRegionHint() {
    const {probeAcrossRegions, probeAllRegions} = this.props;

    // The all-regions mode already shows every region's results.
    if (this.state.allRegions) {
      return null;
    }

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

    if (this.state.probingRegions || this.state.regionMatches.length === 0) {
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
    const {allRegions} = this.state;
    const regionIndex = allRegions ? this.clampedRegionIndex() : -1;
    const columnLabels = this.effectiveColumns().map(extractColumnLabel);
    // The Region column is contextual — keep the record's own first labeled
    // column as the mobile-primary cell.
    const firstPrimaryIndex = columnLabels.findIndex(
      (label, index) => index !== regionIndex && (label ?? '') !== ''
    );

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
      const rowRegion: Cell | undefined = allRegions ? row.__region : undefined;
      const rowCells = this.props.columnsForRow?.(row, this.state.rows, this.state) ?? [];
      const cells = allRegions
        ? rowCells.toSpliced(regionIndex, 0, <td key="__region">{rowRegion?.name}</td>)
        : rowCells;
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
      const rowKey = this.props.keyForRow?.(row) ?? i;
      return (
        // Row ids can collide across regions, so scope the key by region.
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

    const ensuredFilters = filters ?? {};

    const resultTable = (
      <TableScrollWrapper>
        {this.state.pendingRegions.length > 0 && (
          <TableProgressBar data-test-id="table-progress" aria-hidden>
            <TableProgressValue />
          </TableProgressBar>
        )}
        <ResultTable>
          <thead>
            <tr>{this.effectiveColumns()}</tr>
          </thead>
          <tbody>
            {this.state.error
              ? this.renderError()
              : this.state.allRegions
                ? this.renderAllRegionsBody()
                : this.state.loading
                  ? this.renderLoading()
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
    const hasSelectors =
      needsRegion ||
      Boolean(sortOptions && sortOptions.length > 0) ||
      Object.keys(ensuredFilters).length > 0;

    const regionOptions = [
      ...(this.props.allowAllRegions ? [{label: 'All regions', value: ALL_REGIONS}] : []),
      ...cells.map(c => {
        const hasMatch = this.state.regionMatches.some(
          m => m.locality_url === c.locality_url
        );
        return {
          label: c.name,
          value: c.locality_url,
          trailingItems: hasMatch ? <Tag variant="success">found</Tag> : undefined,
        };
      }),
    ];

    // The status note shares the row of the selectors and stays at the right
    // end, so nothing moves while requests run. While regions load it lists
    // the outstanding ones; when a region failed, a warning icon with a
    // tooltip names the failed regions.
    const {pendingRegions, regionErrors} = this.state;
    const moreRegions = cells
      .map(c => c.name)
      .filter(name => this.state.regionCursors[name]);
    const probeNote =
      pendingRegions.length > 0 || regionErrors.length > 0 ? (
        <RegionStatusNote role="status" align="center" gap="sm" wrap="wrap">
          {regionErrors.length > 0 && (
            <Tooltip title={`Could not load results from: ${regionErrors.join(', ')}`}>
              <IconWarning
                variant="warning"
                size="sm"
                aria-label="Some regions failed to load"
              />
            </Tooltip>
          )}
          {pendingRegions.length > 0 ? (
            <Fragment>
              <span>Still loading</span>
              {pendingRegions.map(name => (
                <Tag key={name} variant="muted">
                  {name}
                </Tag>
              ))}
            </Fragment>
          ) : (
            <span>
              {regionErrors.length} {regionErrors.length === 1 ? 'region' : 'regions'}{' '}
              failed
            </span>
          )}
        </RegionStatusNote>
      ) : this.state.probingRegions ? (
        <RegionHintNote>Checking other regions…</RegionHintNote>
      ) : null;

    return (
      <Container data-test-id="result-grid">
        <SortSearchForm onSubmit={this.onSearch}>
          {needsRegion && (
            <SelectorItem>
              <CompactSelect
                trigger={triggerProps => (
                  <OverlayTrigger.Button {...triggerProps} prefix="Region" size="sm" />
                )}
                value={
                  this.state.allRegions
                    ? ALL_REGIONS
                    : this.state.cell
                      ? this.state.cell.locality_url
                      : undefined
                }
                options={regionOptions}
                onChange={opt => this.onChangeCell(opt.value)}
              />
            </SelectorItem>
          )}
          {sortOptions && sortOptions.length > 0 && (
            <SelectorItem>
              <SortBy
                options={sortOptions ?? []}
                value={this.state.sortBy}
                path={path}
                location={location}
              />
            </SelectorItem>
          )}
          {Object.keys(ensuredFilters).map(filterKey => (
            <SelectorItem key={filterKey}>
              <Filter
                queryKey={filterKey}
                value={extractQuery(this.state.filters[filterKey])}
                path={path}
                location={location}
                {...ensuredFilters[filterKey]!}
              />
            </SelectorItem>
          ))}
          {hasSelectors && <RowFiller aria-hidden />}
          {probeNote}
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
        {this.renderRegionHint()}
        {table}
        {hasPagination && this.state.pageLinks && (
          <StyledPagination
            pageLinks={this.state.pageLinks}
            onCursor={useQueryString ? undefined : this.onCursor}
          />
        )}
        {hasPagination && this.state.allRegions && moreRegions.length > 0 && (
          <LoadMoreRow justify="center">
            <Button
              size="sm"
              onClick={this.loadMoreRegions}
              busy={pendingRegions.length > 0}
            >
              {`Load more (${moreRegions.join(', ')})`}
            </Button>
          </LoadMoreRow>
        )}
      </Container>
    );
  }
}

const TableScrollWrapper = styled(Container)`
  position: relative;
  overflow-x: auto;

  @media (max-width: 768px) {
    overflow-x: visible;
  }
`;

const indeterminateSlide = keyframes`
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
`;

const TableProgressBar = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  overflow: hidden;
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
`;

const TableProgressValue = styled('div')`
  width: 40%;
  height: 100%;
  background: ${p => p.theme.tokens.graphics.accent.vibrant};
  animation: ${indeterminateSlide} 1.2s ease-in-out infinite;
`;

const SortSearchForm = styled('form')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.lg};

  &:not(:empty) {
    margin-bottom: ${p => p.theme.space.md};
  }

  /* Gross hack to fix z-index of dropdowns on top of each other */
  button + div {
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

const LoadMoreRow = styled(Flex)`
  margin-bottom: ${p => p.theme.space['2xl']};
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

/**
 * Stretches each selector so a packed row of dropdowns fills the full width
 * and its right edge lines up with the search button in the row below.
 * `RowFiller` keeps the last, partly filled row at natural width.
 */
const SelectorItem = styled('div')`
  display: flex;
  flex: 1 1 auto;
  min-width: max-content;

  > div {
    display: flex;
    width: 100%;
  }

  > div > button {
    width: 100%;
  }
`;

/**
 * Zero-size flex item with an outsized grow factor. It wraps into the last
 * row of selectors and absorbs that row's free space, so only rows that are
 * packed edge to edge get justified — like justified text, where the final
 * line stays left-aligned.
 */
const RowFiller = styled('div')`
  flex: 999 1 auto;
`;

const RegionStatusNote = styled(Flex)`
  align-self: center;
  margin-left: auto;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

const RegionHintNote = styled('div')`
  align-self: center;
  flex-shrink: 0;
  margin-left: auto;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
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
