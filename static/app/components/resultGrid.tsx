import {
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {Client} from 'sentry/api';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {ResultTable} from 'sentry/components/resultTable';
import {IconList, IconSearch, IconWarning} from 'sentry/icons';
import type {Cell} from 'sentry/types/system';
import {getCells} from 'sentry/utils/cells';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

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
  path: string;
  queryKey: string;
  value: string;
};

function Filter({name, queryKey, options, path, value}: FilterProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const allOptions = [
    {value: '', label: 'Any'},
    ...options.map(item => ({value: item[0], label: item[1]})),
  ];

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={name} size="sm" />
      )}
      value={value}
      onChange={opt =>
        navigate({
          pathname: path || location.pathname,
          query: {...location.query, [queryKey]: opt.value || undefined, cursor: ''},
        })
      }
      options={allOptions}
    />
  );
}

type SortByProps = {
  options: Option[];
  path: string;
  value: string;
};

function SortBy({options, path, value}: SortByProps) {
  const location = useLocation();
  const navigate = useNavigate();

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
          pathname: path || location.pathname,
          query: {...location.query, sortBy: opt.value, cursor: ''},
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
   * Overrides the API client used to make requests
   */
  api?: Client;
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

type Request = {
  cursor: string;
  filters: Location['query'];
  query: string;
  sortBy: string;
};

type Results = {
  error: boolean;
  loading: boolean;
  pageLinks: string | null;
  pendingRegions: string[];
  regionCursors: Record<string, string>;
  regionErrors: string[];
  rows: any[];
};

const IDLE_REGIONS: Pick<Results, 'pendingRegions' | 'regionCursors' | 'regionErrors'> = {
  pendingRegions: [],
  regionCursors: {},
  regionErrors: [],
};

type RegionSelection = {
  allRegions: boolean;
  cell: Cell | undefined;
};

type RegionProbe = {
  missingExactMatch: boolean;
  probingRegions: boolean;
  regionMatches: Cell[];
};

const IDLE_PROBE: RegionProbe = {
  regionMatches: [],
  probingRegions: false,
  missingExactMatch: false,
};

const extractQuery = (query: Location['query'][string], defaultVal = '') =>
  (Array.isArray(query) ? query[0] : query) ?? defaultVal;

const hasSearchQuery = (query: Location['query'][string]) =>
  extractQuery(query).trim() !== '';

function buildRequest(query: Location['query'], defaultSort: string): Request {
  return {
    cursor: extractQuery(query.cursor),
    query: extractQuery(query.query),
    sortBy: extractQuery(query.sortBy, defaultSort),
    filters: {...query},
  };
}

export function ResultGrid({
  api: apiProp,
  method = 'GET',
  endpoint,
  path,
  columns,
  filters = {},
  defaultSort = '',
  keyForRow = (row: any) => row.id,
  columnsForRow = () => [],
  defaultParams = {per_page: 50},
  allowAllRegions = false,
  hasPagination = true,
  isCellScoped = false,
  isRegional = false,
  probeAcrossRegions = false,
  probeAllRegions = false,
  useQueryString = true,
  buttonGroup,
  exactMatchQuery,
  hasSearch,
  inPanel,
  onError,
  onLoad,
  panelTitle,
  probeAllRegionsHint,
  regionColumnIndex = 0,
  rowsFromData,
  sortOptions,
  sortValueForRow,
}: ResultGridProps) {
  const defaultApi = useApi();
  const api = apiProp ?? defaultApi;
  const location = useLocation();
  const navigate = useNavigate();

  const needsRegion = isRegional || isCellScoped;

  const [region, setRegion] = useState<RegionSelection>(() => {
    if (!needsRegion) {
      return {allRegions: false, cell: undefined};
    }
    const cells = getCells();
    const regionUrl = extractQuery(location.query.regionUrl);
    const requestedCell = regionUrl
      ? cells.find(c => c.locality_url === regionUrl)
      : undefined;
    const allRegions = allowAllRegions && !requestedCell;
    return {allRegions, cell: allRegions ? undefined : (requestedCell ?? cells[0])};
  });
  const {allRegions, cell} = region;

  // The request parameters live in the URL when `useQueryString` is on, and in
  // component state otherwise. Deriving them keeps the two modes on one code
  // path — only the source of truth differs.
  const [localRequest, setLocalRequest] = useState<Request>(() =>
    buildRequest({}, defaultSort)
  );
  const request = useQueryString
    ? buildRequest(location.query, defaultSort)
    : localRequest;

  const [queryInput, setQueryInput] = useState(request.query);
  const [results, setResults] = useState<Results>({
    ...IDLE_REGIONS,
    rows: [],
    loading: true,
    error: false,
    pageLinks: null,
  });
  const [probe, setProbe] = useState<RegionProbe>(IDLE_PROBE);

  // Monotonic token used to discard results from stale region probes (e.g.
  // when the user switches regions or searches again before probes resolve).
  const probeTokenRef = useRef(0);
  // Monotonic token used to discard responses from a superseded all-regions
  // fetch (e.g. the user changed the sort or region while regions were still
  // responding).
  const fetchTokenRef = useRef(0);

  // Transform endpoint to cell-scoped URL if needed
  // Currently using region.name (e.g., "us", "de") as the cell_id.
  // In the future when there's a cell selector, we would use the actual cell ID instead.
  const cellEndpoint = (target: Cell | undefined) =>
    isCellScoped && target ? `/_admin/cells/${target.name}${endpoint}` : endpoint;

  /**
   * Fire a cheap (`per_page: 1`) search against every other region to find out
   * which ones have matches for the current query. Runs only after the active
   * region returns no results, so there is no cost on the common path.
   */
  const probeOtherRegions = (
    baseParams: Record<string, any>,
    currentCell: Cell | undefined
  ) => {
    const otherCells = getCells().filter(
      c => c.locality_url !== currentCell?.locality_url
    );
    if (otherCells.length === 0) {
      return;
    }

    const token = ++probeTokenRef.current;
    setProbe(prev => ({...prev, probingRegions: true, regionMatches: []}));

    // per_page: 1 — we only need to know whether the region has any match, not
    // how many. The admin customers endpoint doesn't return an X-Hits total, so
    // we deliberately surface presence only rather than an unreliable count.
    const probeParams = {...baseParams, cursor: '', per_page: 1};
    const matches: Cell[] = [];
    let remaining = otherCells.length;

    const finalize = () => {
      remaining -= 1;
      // Ignore results from a probe that has since been superseded.
      if (remaining > 0 || token !== probeTokenRef.current) {
        return;
      }
      matches.sort((a, b) => a.name.localeCompare(b.name));
      setProbe(prev => ({...prev, probingRegions: false, regionMatches: matches}));
    };

    otherCells.forEach(probedCell => {
      api.request(cellEndpoint(probedCell), {
        method,
        host: probedCell.locality_url,
        data: probeParams,
        success: data => {
          const rows = rowsFromData?.(data, probedCell) ?? data;
          if (Array.isArray(rows) && rows.length > 0) {
            matches.push(probedCell);
          }
          finalize();
        },
        error: () => finalize(),
      });
    });
  };

  // TODO(dcramer): this should whitelist filters/sortBy/cursor/perPage
  const buildQueryParams = (): Record<string, any> => ({
    ...defaultParams,
    ...(useQueryString ? location.query : request.query ? {query: request.query} : {}),
    sortBy: request.sortBy,
    cursor: request.cursor,
  });

  // Merged all-regions rows are re-sorted descending to match the server's
  // ordering. Without `sortValueForRow`, rows keep arrival order.
  const sortRows = (rows: any[], sortBy: string) =>
    sortValueForRow
      ? rows.toSorted((a, b) => sortValueForRow(b, sortBy) - sortValueForRow(a, sortBy))
      : rows;

  /**
   * Request one page from each given region, merge the rows into the table and
   * record the cursor of any region that reports a further page.
   */
  const fetchRegionPages = (
    pages: Array<{cell: Cell; cursor: string}>,
    queryParams: Record<string, any>
  ) => {
    const token = fetchTokenRef.current;
    const names = pages.map(page => page.cell.name);
    const sortBy = request.sortBy;

    pages.forEach(({cell: pageCell, cursor}) => {
      const markFailed = () => {
        if (token !== fetchTokenRef.current) {
          return;
        }
        setResults(prev => {
          if (!prev.pendingRegions.includes(pageCell.name)) {
            return prev;
          }
          const regionErrors = [...prev.regionErrors, pageCell.name];
          return {
            ...prev,
            // Every region of this load failing with nothing to show is a
            // failed load. A region failing under rows we already have is a
            // partial result, so keep the table.
            error:
              prev.rows.length === 0 && names.every(name => regionErrors.includes(name)),
            pendingRegions: prev.pendingRegions.filter(name => name !== pageCell.name),
            regionErrors,
          };
        });
      };

      const pageRequest = api.request(cellEndpoint(pageCell), {
        method,
        host: pageCell.locality_url,
        data: {...queryParams, cursor},
        success: (data, _, resp) => {
          if (token !== fetchTokenRef.current) {
            return;
          }
          const rows = rowsFromData?.(data, pageCell) ?? data;
          const tagged = (Array.isArray(rows) ? rows : []).map(row => ({
            ...row,
            __region: pageCell,
          }));
          const next = parseLinkHeader(resp?.getResponseHeader('Link') ?? '').next;
          const nextCursor = next?.results === true ? (next.cursor ?? '') : '';

          setResults(prev => {
            if (!prev.pendingRegions.includes(pageCell.name)) {
              return prev;
            }
            const regionCursors = {...prev.regionCursors};
            if (nextCursor) {
              regionCursors[pageCell.name] = nextCursor;
            } else {
              delete regionCursors[pageCell.name];
            }
            return {
              ...prev,
              rows: sortRows([...prev.rows, ...tagged], sortBy),
              pendingRegions: prev.pendingRegions.filter(name => name !== pageCell.name),
              regionCursors,
            };
          });
          onLoad?.();
        },
        error: res => {
          markFailed();
          onError?.(res);
        },
      });

      // The API client swallows a rejection of the fetch itself (a blocked
      // request, a network failure) without running either callback, which
      // would leave the region pending forever. Catch it here so the region
      // resolves to failed. An abort from api.clear() also lands here, but
      // the fetch token was already bumped by then, so markFailed ignores it.
      pageRequest?.requestPromise?.catch(markFailed);
    });
  };

  /**
   * Query every region in parallel and merge the results into one table. Each
   * region's rows are tagged with their cell (rendered as the Region column)
   * and the merged set is re-sorted as every response arrives, so the table
   * stays coherently ordered while regions trickle in.
   */
  const fetchAllRegions = (queryParams: Record<string, any>) => {
    const cells = getCells();

    if (cells.length === 0) {
      setResults(prev => ({
        ...prev,
        ...IDLE_REGIONS,
        loading: false,
        error: false,
        rows: [],
        pageLinks: null,
      }));
      return;
    }

    setResults(prev => ({
      ...prev,
      ...IDLE_REGIONS,
      loading: false,
      error: false,
      rows: [],
      pageLinks: null,
      pendingRegions: cells.map(c => c.name),
    }));

    fetchRegionPages(
      cells.map(pageCell => ({cell: pageCell, cursor: ''})),
      queryParams
    );
  };

  /**
   * Load the next page of every region that still has one and append it to the
   * merged table. A merged view has no cursor of its own — cursors do not
   * compose across regions — so it grows a page per region at a time.
   */
  const loadMoreRegions = () => {
    const {regionCursors} = results;
    const pages = getCells().flatMap(pageCell => {
      const cursor = regionCursors[pageCell.name];
      return cursor ? [{cell: pageCell, cursor}] : [];
    });

    if (pages.length === 0) {
      return;
    }

    const names = pages.map(page => page.cell.name);
    // A region that failed keeps its warning unless this load asks it again —
    // it holds no cursor, so nothing here retries it, and its results are
    // still missing from the table.
    setResults(prev => ({
      ...prev,
      pendingRegions: names,
      regionErrors: prev.regionErrors.filter(name => !names.includes(name)),
    }));
    fetchRegionPages(pages, buildQueryParams());
  };

  const fetchData = useEffectEvent(() => {
    // Avoid slow-fetch race conditions
    api.clear();

    // api.clear() aborts any in-flight region probe, and aborted requests never
    // run their success/error callbacks — so probeOtherRegions' finalize() would
    // never fire and probingRegions would stay stuck. Invalidate the probe (bump
    // the token) and clear its UI state here, the single entry point for fetches,
    // so it's reset regardless of which caller we hit.
    probeTokenRef.current += 1;
    fetchTokenRef.current += 1;
    setProbe(prev => (prev === IDLE_PROBE ? prev : IDLE_PROBE));
    // Only a URL-driven reload drops the page links. Clearing them on a
    // `useQueryString: false` cursor click would make the pagination control
    // vanish out from under the cursor that just clicked it.
    setResults(prev => ({
      ...prev,
      ...IDLE_REGIONS,
      loading: true,
      error: false,
      pageLinks: useQueryString ? null : prev.pageLinks,
    }));

    const queryParams = buildQueryParams();

    if (allRegions) {
      fetchAllRegions(queryParams);
      return;
    }

    const activeCell = cell;

    api.request(cellEndpoint(activeCell), {
      method,
      host: activeCell ? activeCell.locality_url : undefined,
      data: queryParams,
      success: (data, _, resp) => {
        const rows = rowsFromData?.(data, activeCell) ?? data;
        const rowsArray = Array.isArray(rows) ? rows : [];

        // The query lives in the URL when useQueryString is on, otherwise in
        // component state — fall back so probes always carry the search term.
        const query = queryParams.query ?? request.query;
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
          probeAcrossRegions &&
          isCompleteResultSet &&
          hasSearchQuery(query) &&
          (exactMatchQuery
            ? !rowsArray.some(row => exactMatchQuery(row, normalizedQuery))
            : isEmpty)
        );

        setResults({...IDLE_REGIONS, loading: false, error: false, rows, pageLinks});
        setProbe({...IDLE_PROBE, missingExactMatch});
        onLoad?.();

        // `probeAllRegions` always checks the other regions for presence, even
        // when the active region has results or no search is active. This flags
        // that the same subject (e.g. a user) also has records elsewhere.
        if (missingExactMatch || probeAllRegions) {
          probeOtherRegions({...queryParams, query}, activeCell);
        }
      },
      error: res => {
        setResults(prev => ({...prev, loading: false, error: true}));
        onError?.(res);
      },
    });
  });

  // A fetch is driven by the URL when `useQueryString` is on, and by the local
  // request otherwise. Either way a new identity means "go fetch again".
  const requestSignal = useQueryString ? location : localRequest;

  useEffect(() => {
    fetchData();
  }, [requestSignal, region]);

  useEffect(() => {
    if (useQueryString) {
      setQueryInput(request.query);
    }
  }, [useQueryString, request.query]);

  const stripRegionUrl = useEffectEvent(() => {
    if (needsRegion && location.query.regionUrl) {
      navigate(
        {pathname: location.pathname, query: {...location.query, regionUrl: undefined}},
        {replace: true}
      );
    }
  });

  useEffect(() => {
    stripRegionUrl();
  }, []);

  const onChangeCell = (localityUrl: string | undefined) => {
    const nextRegion: RegionSelection | undefined =
      localityUrl === ALL_REGIONS
        ? {allRegions: true, cell: undefined}
        : (() => {
            const nextCell = getCells().find(c => c.locality_url === localityUrl);
            return nextCell ? {allRegions: false, cell: nextCell} : undefined;
          })();
    if (nextRegion === undefined) {
      return;
    }
    // Invalidate any in-flight probe before switching regions.
    probeTokenRef.current += 1;
    setProbe(IDLE_PROBE);
    setResults(prev => ({
      ...prev,
      loading: true,
      rows: nextRegion.allRegions ? [] : prev.rows,
    }));
    setRegion(nextRegion);
  };

  // TODO(dcramer): doesnt correctly respect filters without query strings
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (useQueryString) {
      navigate({
        pathname: path,
        query: {...location.query, query: queryInput, cursor: ''},
      });
    } else {
      setLocalRequest(prev => ({...prev, query: queryInput, cursor: ''}));
    }
  };

  const onCursor = (cursor: string | undefined) => {
    setLocalRequest(prev => ({...prev, cursor: cursor ?? ''}));
  };

  const state: State = {
    ...results,
    ...probe,
    ...request,
    allRegions,
    cell,
    query: queryInput,
  };

  const clampedRegionIndex = Math.min(Math.max(regionColumnIndex, 0), columns.length);
  const effectiveColumns = allRegions
    ? columns.toSpliced(
        clampedRegionIndex,
        0,
        <th key="__region" style={{width: 70}}>
          Region
        </th>
      )
    : columns;

  function renderLoading() {
    return (
      <tr>
        <td colSpan={effectiveColumns.length}>
          <LoadingIndicator>Hold on to your butts!</LoadingIndicator>
        </td>
      </tr>
    );
  }

  function renderError() {
    return (
      <tr>
        <td colSpan={effectiveColumns.length}>
          <ErrorAlert variant="danger" showIcon>
            Something bad happened :/
          </ErrorAlert>
        </td>
      </tr>
    );
  }

  function renderNoResults() {
    return (
      <tr>
        <td colSpan={effectiveColumns.length}>
          <EmptyMessage>No results</EmptyMessage>
        </td>
      </tr>
    );
  }

  function renderResults() {
    const regionIndex = allRegions ? clampedRegionIndex : -1;
    const columnLabels = effectiveColumns.map(extractColumnLabel);
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

    return results.rows.map((row, i) => {
      const rowRegion: Cell | undefined = allRegions ? row.__region : undefined;
      const rowCells = columnsForRow(row, results.rows, state);
      const cells = allRegions
        ? rowCells.toSpliced(regionIndex, 0, <td key="__region">{rowRegion?.name}</td>)
        : rowCells;
      const labeledCells = cells.map((gridCell, j) => {
        if (!isValidElement(gridCell)) {
          return gridCell;
        }
        const extraProps: Record<string, unknown> = {'data-label': columnLabels[j] ?? ''};
        if (j === firstPrimaryIndex) {
          extraProps['data-mobile-primary'] = 'true';
        }
        return cloneElement(
          gridCell as React.ReactElement<Record<string, unknown>>,
          extraProps
        );
      });
      const rowKey = keyForRow(row) ?? i;
      return (
        // Row ids can collide across regions, so scope the key by region.
        <tr key={rowRegion ? `${rowRegion.name}:${rowKey}` : rowKey} style={labelVars}>
          {labeledCells}
        </tr>
      );
    });
  }

  function renderBody() {
    if (results.error) {
      return renderError();
    }
    // Rows render as regions respond. The "still updating" signal lives outside
    // the body, so rows never shift while regions trickle in, and "No results"
    // only shows once every region has answered.
    if (allRegions) {
      if (results.rows.length > 0) {
        return renderResults();
      }
      if (results.loading || results.pendingRegions.length > 0) {
        return renderLoading();
      }
      return renderNoResults();
    }
    if (results.loading) {
      return renderLoading();
    }
    if (results.rows.length === 0) {
      return renderNoResults();
    }
    return renderResults();
  }

  function renderRegionHint() {
    // The all-regions mode already shows every region's results.
    if (allRegions) {
      return null;
    }

    if ((!probeAcrossRegions && !probeAllRegions) || results.loading || results.error) {
      return null;
    }

    // The search-driven hint only surfaces when the active region lacked an
    // exact match. The always-on `probeAllRegions` hint has no such gate.
    if (!probeAllRegions && !probe.missingExactMatch) {
      return null;
    }

    if (probe.probingRegions || probe.regionMatches.length === 0) {
      return null;
    }

    const regionButtons = probe.regionMatches.map(matchedCell => (
      <Button
        key={matchedCell.locality_url}
        size="xs"
        onClick={() => onChangeCell(matchedCell.locality_url)}
      >
        {`View in ${matchedCell.name}`}
      </Button>
    ));

    if (probeAllRegions) {
      const lead =
        probeAllRegionsHint ?? 'Also found in other data regions — look there too:';
      return (
        <RegionHintAlert variant="info" showIcon>
          <Flex align="center" gap="md" wrap="wrap">
            <span>{lead}</span>
            {regionButtons}
          </Flex>
        </RegionHintAlert>
      );
    }

    const currentName = cell?.name ?? 'this region';
    // The active region returned similar (but not exact) matches — make it
    // clear the exact record was not found here, rather than implying no
    // results at all.
    const leadText = results.rows.length > 0 ? 'No exact match in' : 'No results in';

    return (
      <RegionHintAlert variant="info" showIcon>
        <Flex align="center" gap="md" wrap="wrap">
          <span>
            {leadText} <strong>{currentName}</strong>. Found results in another data
            region:
          </span>
          {regionButtons}
        </Flex>
      </RegionHintAlert>
    );
  }

  const resultTable = (
    <TableScrollWrapper>
      {results.pendingRegions.length > 0 && (
        <TableProgressBar data-test-id="table-progress" aria-hidden>
          <TableProgressValue />
        </TableProgressBar>
      )}
      <ResultTable>
        <thead>
          <tr>{effectiveColumns}</tr>
        </thead>
        <tbody>{renderBody()}</tbody>
      </ResultTable>
    </TableScrollWrapper>
  );

  const CustomPanel = inPanel;

  const table = CustomPanel ? (
    CustomPanel === true ? (
      <Panel>
        {panelTitle && (
          <PanelHeader hasButtons={!!buttonGroup}>
            {panelTitle}
            {buttonGroup}
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
  const hasSelectors =
    needsRegion ||
    Boolean(sortOptions && sortOptions.length > 0) ||
    Object.keys(filters).length > 0;

  const regionOptions = [
    ...(allowAllRegions ? [{label: 'All regions', value: ALL_REGIONS}] : []),
    ...cells.map(c => {
      const hasMatch = probe.regionMatches.some(m => m.locality_url === c.locality_url);
      return {
        label: c.name,
        value: c.locality_url,
        trailingItems: hasMatch ? <Tag variant="success">found</Tag> : undefined,
      };
    }),
  ];

  const {pendingRegions, regionErrors} = results;
  const moreRegions = cells.map(c => c.name).filter(name => results.regionCursors[name]);
  // The status note shares the row of the selectors, so nothing moves while
  // requests run. While regions load it lists the outstanding ones; when a
  // region failed, a warning icon with a tooltip names the failed regions.
  const statusNote =
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
    ) : probe.probingRegions ? (
      <RegionHintNote>Checking other regions…</RegionHintNote>
    ) : null;

  return (
    <Container data-test-id="result-grid">
      <SortSearchForm onSubmit={onSearch}>
        {needsRegion && (
          <SelectorItem>
            <CompactSelect
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} prefix="Region" size="sm" />
              )}
              value={allRegions ? ALL_REGIONS : cell ? cell.locality_url : undefined}
              options={regionOptions}
              onChange={opt => onChangeCell(opt.value)}
            />
          </SelectorItem>
        )}
        {sortOptions && sortOptions.length > 0 && (
          <SelectorItem>
            <SortBy options={sortOptions} value={request.sortBy} path={path} />
          </SelectorItem>
        )}
        {Object.keys(filters).map(filterKey => (
          <SelectorItem key={filterKey}>
            <Filter
              queryKey={filterKey}
              value={extractQuery(request.filters[filterKey])}
              path={path}
              {...filters[filterKey]!}
            />
          </SelectorItem>
        ))}
        {hasSelectors && !hasSearch && <RowFiller aria-hidden />}
        {hasSearch && (
          <Flex align="center" gap="xs" flex="999 1 auto" minWidth="240px">
            <SearchInput
              type="text"
              placeholder="Search"
              name="query"
              autoComplete="off"
              value={queryInput}
              onChange={evt => setQueryInput(evt.target.value)}
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
        {statusNote}
      </SortSearchForm>
      {renderRegionHint()}
      {table}
      {hasPagination && results.pageLinks && (
        <StyledPagination
          pageLinks={results.pageLinks}
          onCursor={useQueryString ? undefined : onCursor}
        />
      )}
      {hasPagination && allRegions && moreRegions.length > 0 && (
        <LoadMoreRow justify="center">
          <Button size="sm" onClick={loadMoreRegions} busy={pendingRegions.length > 0}>
            {`Load more (${moreRegions.join(', ')})`}
          </Button>
        </LoadMoreRow>
      )}
    </Container>
  );
}

const TableScrollWrapper = styled(Container)`
  position: relative;
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
  button + div {
    z-index: ${p => p.theme.zIndex.dropdown + 2};
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

/**
 * Stretches each selector so a packed row of dropdowns fills the full width.
 * The search box (or `RowFiller` without one) absorbs the free space of the
 * last, partly filled row so it keeps natural widths, like justified text.
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

const RowFiller = styled('div')`
  flex: 999 1 auto;
`;

const LoadMoreRow = styled(Flex)`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const RegionStatusNote = styled(Flex)`
  align-self: center;
  margin-left: auto;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
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
  align-self: center;
  flex-shrink: 0;
  margin-left: auto;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
`;
