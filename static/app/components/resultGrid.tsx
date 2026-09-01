import {
  cloneElement,
  isValidElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
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

import type {Client} from 'sentry/api';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {ResultTable} from 'sentry/components/resultTable';
import {IconList, IconSearch} from 'sentry/icons';
import type {Cell} from 'sentry/types/system';
import {getCells} from 'sentry/utils/cells';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

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
        <OverlayTrigger.Button {...triggerProps} prefix={name} size="xs" />
      )}
      value={value}
      onChange={opt =>
        navigate({
          pathname: path || location.pathname,
          query: {...location.query, [queryKey]: opt.value, cursor: ''},
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
  rows: any[];
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
  rowsFromData,
  sortOptions,
}: ResultGridProps) {
  const defaultApi = useApi();
  const api = apiProp ?? defaultApi;
  const location = useLocation();
  const navigate = useNavigate();

  const needsRegion = isRegional || isCellScoped;

  const [cell, setCell] = useState<Cell | undefined>(() => {
    if (!needsRegion) {
      return;
    }
    const cells = getCells();
    const regionUrl = extractQuery(location.query.regionUrl);
    return regionUrl ? cells.find(c => c.locality_url === regionUrl) : cells[0];
  });

  /**
   * The request parameters live in the URL when `useQueryString` is on, and in
   * component state otherwise. Deriving them keeps the two modes on one code
   * path — only the source of truth differs.
   */
  const [localRequest, setLocalRequest] = useState<Request>(() =>
    buildRequest(location.query, defaultSort)
  );
  const request = useQueryString
    ? buildRequest(location.query, defaultSort)
    : localRequest;

  const [queryInput, setQueryInput] = useState(request.query);
  const [results, setResults] = useState<Results>({
    rows: [],
    loading: true,
    error: false,
    pageLinks: null,
  });
  const [probe, setProbe] = useState<RegionProbe>(IDLE_PROBE);

  /**
   * Monotonic token used to discard results from stale region probes (e.g.
   * when the user switches regions or searches again before probes resolve).
   */
  const probeTokenRef = useRef(0);

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

  const fetchData = useEffectEvent(() => {
    // Avoid slow-fetch race conditions
    api.clear();

    // api.clear() aborts any in-flight region probe, and aborted requests never
    // run their success/error callbacks — so probeOtherRegions' finalize() would
    // never fire and probingRegions would stay stuck. Invalidate the probe (bump
    // the token) and clear its UI state here, the single entry point for fetches,
    // so it's reset regardless of which caller we hit.
    probeTokenRef.current += 1;
    setProbe(prev => (prev === IDLE_PROBE ? prev : IDLE_PROBE));
    // Only a URL-driven reload drops the page links. Clearing them on a
    // `useQueryString: false` cursor click would make the pagination control
    // vanish out from under the cursor that just clicked it.
    setResults(prev => ({
      ...prev,
      loading: true,
      error: false,
      pageLinks: useQueryString ? null : prev.pageLinks,
    }));

    // TODO(dcramer): this should whitelist filters/sortBy/cursor/perPage
    const queryParams: Record<string, any> = {
      ...defaultParams,
      ...(useQueryString ? location.query : {}),
      sortBy: request.sortBy,
      cursor: request.cursor,
    };

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

        setResults({loading: false, error: false, rows, pageLinks});
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
  }, [requestSignal, cell]);

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
    const nextCell = getCells().find(c => c.locality_url === localityUrl);
    if (nextCell === undefined) {
      return;
    }
    // Invalidate any in-flight probe before switching regions.
    probeTokenRef.current += 1;
    setProbe(IDLE_PROBE);
    setCell(nextCell);
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

  const state: State = {...results, ...probe, ...request, cell, query: queryInput};

  function renderBody() {
    if (results.loading) {
      return (
        <tr>
          <td colSpan={columns.length}>
            <LoadingIndicator>Hold on to your butts!</LoadingIndicator>
          </td>
        </tr>
      );
    }

    if (results.error) {
      return (
        <tr>
          <td colSpan={columns.length}>
            <ErrorAlert variant="danger" showIcon>
              Something bad happened :/
            </ErrorAlert>
          </td>
        </tr>
      );
    }

    if (results.rows.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length}>
            <EmptyMessage>No results</EmptyMessage>
          </td>
        </tr>
      );
    }

    const columnLabels = columns.map(extractColumnLabel);
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

    return results.rows.map((row, i) => {
      const cells = columnsForRow(row, results.rows, state);
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
      return (
        <tr key={keyForRow(row) ?? i} style={labelVars}>
          {labeledCells}
        </tr>
      );
    });
  }

  function renderRegionHint() {
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
      <ResultTable>
        <thead>
          <tr>{columns}</tr>
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

  return (
    <Container data-test-id="result-grid">
      <SortSearchForm onSubmit={onSearch}>
        {needsRegion && (
          <CompactSelect
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} prefix="Region" />
            )}
            value={cell ? cell.locality_url : undefined}
            options={getCells().map(c => {
              const hasMatch = probe.regionMatches.some(
                m => m.locality_url === c.locality_url
              );
              return {
                label: c.name,
                value: c.locality_url,
                trailingItems: hasMatch ? <Tag variant="success">found</Tag> : undefined,
              };
            })}
            onChange={opt => onChangeCell(opt.value)}
          />
        )}
        {sortOptions && sortOptions.length > 0 && (
          <SortBy options={sortOptions} value={request.sortBy} path={path} />
        )}
        {/* The note shares the row of the selectors and stays at the right end. It
            never renders above the results, so nothing moves while the probe runs. */}
        {probe.probingRegions && <RegionHintNote>Checking other regions…</RegionHintNote>}
        {hasSearch && (
          <Flex align="center" gap="xs" width="100%">
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
      </SortSearchForm>
      {Object.keys(filters).length > 0 && (
        <FilterList>
          {Object.keys(filters).map(filterKey => (
            <Filter
              key={filterKey}
              queryKey={filterKey}
              value={extractQuery(request.filters[filterKey])}
              path={path}
              {...filters[filterKey]!}
            />
          ))}
        </FilterList>
      )}
      {renderRegionHint()}
      {table}
      {hasPagination && results.pageLinks && (
        <StyledPagination
          pageLinks={results.pageLinks}
          onCursor={useQueryString ? undefined : onCursor}
        />
      )}
    </Container>
  );
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
  align-self: center;
  flex-shrink: 0;
  margin-left: auto;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
`;
