import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {keepPreviousData, skipToken, useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getCells} from 'sentry/utils/cells';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type RowStatus = 'match' | 'mismatch' | 'legacy_only' | 'platform_only';

type Row = {
  delta_cents: number;
  delta_pct: number | null;
  // guid is present only when the side has exactly one invoice in the window
  // (otherwise there's no single invoice to deep-link to).
  legacy_amount: number | null;
  legacy_invoice_count: number;
  legacy_invoice_guid: string | null;
  organization_id: number;
  organization_slug: string | null;
  platform_amount: number | null;
  platform_invoice_count: number;
  platform_invoice_guid: string | null;
  status: RowStatus;
};

type Summary = {
  end: string;
  legacy_count: number;
  over_threshold_count: number;
  over_threshold_pct: number;
  platform_count: number;
  queried_at: string;
  row_count: number;
  rows_page: number;
  rows_page_size: number;
  rows_total_pages: number;
  start: string;
};

type ComparisonResponse = {
  rows: Row[];
  summary: Summary;
};

const STATUS_VARIANT: Record<RowStatus, TagProps['variant']> = {
  match: 'success',
  mismatch: 'warning',
  legacy_only: 'danger',
  platform_only: 'danger',
};

function formatDollars(cents: number | null) {
  if (cents === null) {
    return <em>—</em>;
  }
  const dollars = cents / 100;
  return `$${dollars.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Render a dollar amount, deep-linking to the admin invoice detail page when
// the side has a single invoice. AdminInvoiceDetailsEndpoint resolves legacy
// and platform invoices alike by guid, and unlike the org-scoped receipts
// page it doesn't hide legacy shadow invoices for migrated orgs.
function InvoiceAmount({
  cents,
  guid,
  region,
}: {
  cents: number | null;
  guid: string | null;
  region: string | undefined;
}) {
  const amount = formatDollars(cents);
  if (!guid || !region) {
    return amount;
  }
  return <Link to={`/_admin/invoices/${region}/${guid}/`}>{amount}</Link>;
}

function formatPercent(pct: number | null) {
  if (pct === null) {
    // No legacy baseline — sorts to top of the list.
    return <em>∞</em>;
  }
  return `${(pct * 100).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`;
}

// `formatPercent` renders ``null`` as ``∞`` because for ``delta_pct`` rows
// a missing percentage means "undefined drift" (legacy=$0 with non-zero
// platform — sorts to the top of the list). That semantic doesn't apply
// to summary ratios like ``over_threshold_pct``, where a runtime
// ``null``/``undefined`` would just mean the backend didn't populate the
// field (deploy-window race, response-shape drift). Render those as
// ``N/A`` instead of pretending the metric blew up.
function formatPercentOrNA(pct: number | null | undefined) {
  if (pct === null || pct === undefined) {
    return <em>N/A</em>;
  }
  return `${(pct * 100).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`;
}

// Same deploy-window-race rationale as `formatPercentOrNA`: the type
// declares these as `number` but a stale-cached response or any future
// shape drift could leave them runtime-`undefined`, which would render
// the literal string "undefined" in the UI. Falling back to an em dash
// matches the missing-value affordance `formatDollars` already uses.
function formatCountOrNA(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) {
    return <em>—</em>;
  }
  return n.toLocaleString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The window covers whole UTC days. Most invoices of both kinds are created
// in a burst just after 00:00 UTC, and the platform one can land an hour or
// more after the legacy one. A window that starts or ends between them shows
// one side only, so the endpoint takes days rather than times.

// The UTC day (`YYYY-MM-DD`, the value of a `date` input) that contains `ms`.
function utcDay(ms: number): string {
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

// The URL carries days only. Anything else is ignored.
function parseDayParam(value: unknown): string | undefined {
  const day = firstQueryValue(value);
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) && utcDay(Date.parse(day)) === day
    ? day
    : undefined;
}

const PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100, 250];
const DEFAULT_PAGE_SIZE = 50;

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' ? value : undefined;
}

function parsePageParam(value: unknown): number {
  const n = Number(firstQueryValue(value));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parsePageSizeParam(value: unknown): number {
  const n = Number(firstQueryValue(value));
  return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function InvoiceComparison() {
  const cells = getCells();
  const location = useLocation();
  const navigate = useNavigate();

  // URL is the source of truth for everything that affects the query and
  // the displayed paginator state, so refresh / share-link reproduces the
  // exact view. Local state only tracks what the user is typing in the
  // date inputs before they click Run.
  const [queryRegion, setQueryRegion] = useQueryState('region', parseAsString);
  const cell = cells.find(c => c.name === queryRegion) ?? cells[0] ?? null;
  const queryStart = parseDayParam(location.query.start);
  const queryEnd = parseDayParam(location.query.end);
  const rowsPage = parsePageParam(location.query.rows_page);
  const pageSize = parsePageSizeParam(location.query.page_size);

  // Without a window in the URL (first visit, or a link that only carries
  // pagination params) query yesterday, the last complete UTC day, so the
  // tables load without waiting on Run. Frozen at mount so paginating doesn't
  // shift the window.
  const [defaultDay] = useState(() => utcDay(Date.now() - DAY_MS));
  // A single bound in the URL is not a range. Filling the other side from the
  // default makes the endpoint reject `end < start`, or loads every invoice
  // since an old start (`compare_invoices` reads the whole window, then
  // paginates), so don't query until both are set.
  const urlHasBound = Boolean(queryStart || queryEnd);
  const startDay = urlHasBound ? (queryStart ?? '') : defaultDay;
  const endDay = urlHasBound ? (queryEnd ?? '') : defaultDay;
  const hasWindow = Boolean(startDay && endDay);

  const [startInput, setStartInput] = useState(startDay);
  const [endInput, setEndInput] = useState(endDay);

  // Keep the date inputs in sync with the window being shown on back/forward
  // and in-app navigation (e.g. opening a shared link). Keyed on the shown
  // days rather than the URL, so pinning the default window into an empty
  // URL doesn't clobber dates typed but not yet run.
  const [shownDays, setShownDays] = useState({startDay, endDay});
  if (shownDays.startDay !== startDay || shownDays.endDay !== endDay) {
    setShownDays({startDay, endDay});
    if (startDay) {
      setStartInput(startDay);
    }
    if (endDay) {
      setEndInput(endDay);
    }
  }

  // Written into every URL this page rewrites, so a refresh or shared link
  // reproduces the window being shown. Left out for a one-sided URL so the
  // bound that is there isn't replaced.
  const pinnedWindow = useMemo(
    () => (hasWindow ? {start: startDay, end: endDay} : {}),
    [hasWindow, startDay, endDay]
  );

  const {data, isLoading, isError, error, isPlaceholderData} = useQuery({
    ...apiOptions.as<ComparisonResponse>()('/_admin/cells/$region/invoice-comparison/', {
      path: cell && hasWindow ? {region: cell.name} : skipToken,
      host: cell?.locality_url,
      query: {
        start: hasWindow ? startDay : undefined,
        end: hasWindow ? endDay : undefined,
        rows_page: rowsPage,
        rows_page_size: pageSize,
      },
      staleTime: 0,
    }),
    // Keep the previously-rendered page visible while paginating or
    // changing page size, so the tables and summary don't unmount and
    // collapse the layout to a spinner between requests.
    placeholderData: keepPreviousData,
  });

  // If the URL has an unsupported `page_size` (e.g. `?page_size=200`),
  // rewrite it to the resolved value so the address bar matches what the
  // API and UI actually use — and refresh / share-links reproduce the
  // intended view. Done eagerly (not gated on `data`) since the validity
  // check is purely client-side.
  const rawPageSize = firstQueryValue(location.query.page_size);
  useEffect(() => {
    if (rawPageSize !== undefined && rawPageSize !== String(pageSize)) {
      navigate(
        {
          pathname: location.pathname,
          query: {...location.query, ...pinnedWindow, page_size: String(pageSize)},
        },
        {replace: true}
      );
    }
  }, [rawPageSize, pageSize, navigate, location.pathname, location.query, pinnedWindow]);

  // If the backend clamped our requested page (e.g. user landed on
  // ?rows_page=99 against a 2-page result), rewrite the URL to the
  // clamped value so refresh + share-links converge on the real page.
  //
  // Skip while `data` is the placeholder from the previous page — its
  // summary describes the prior request, not the one we just kicked
  // off, so honoring it would rewrite the URL back to where we just
  // were and break Prev/Next.
  useEffect(() => {
    if (!data || isPlaceholderData) {
      return;
    }
    const fixes: Record<string, string> = {};
    if (data.summary.rows_page !== rowsPage) {
      fixes.rows_page = String(data.summary.rows_page);
    }
    if (Object.keys(fixes).length > 0) {
      navigate(
        {
          pathname: location.pathname,
          query: {...location.query, ...pinnedWindow, ...fixes},
        },
        {replace: true}
      );
    }
  }, [
    data,
    isPlaceholderData,
    rowsPage,
    navigate,
    location.pathname,
    location.query,
    pinnedWindow,
  ]);

  // The endpoint returns rows pre-sorted by |delta_pct| desc; this component
  // does not re-sort. See AdminInvoiceComparisonEndpoint and its test_sort_*
  // tests for the contract.
  const rows = data?.rows ?? [];

  const setRowsPage = (page: number) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, ...pinnedWindow, rows_page: String(page)},
    });
  };

  const setPageSize = (size: number) => {
    // Changing page size with a non-1 page is almost never what the user
    // wants — the offset they were viewing maps to a different position in
    // the resized list. Reset the paginator.
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        ...pinnedWindow,
        page_size: String(size),
        rows_page: '1',
      },
    });
  };

  const onSubmit = () => {
    if (!startInput || !endInput) {
      return;
    }
    // Re-running the comparison persists the chosen window to the URL and
    // resets the paginator — the new window's result set is unrelated to
    // the previous one's page number.
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        start: startInput,
        end: endInput,
        rows_page: '1',
        page_size: String(pageSize),
      },
    });
  };

  return (
    <Fragment>
      <p>
        Per-org totals comparing legacy <code>Invoice</code> and shadow{' '}
        <code>PlatformInvoice</code> records <strong>generated</strong> in the selected
        whole UTC days from the first to the last selected day (filtered on{' '}
        <code>date_added</code>). <strong>Legacy invoices</strong> (count and dollar
        total) are scoped to orgs that have invoices on both sides — legacy-only orgs
        haven't been onboarded to the platform yet, so counting them would inflate the
        parity tallies with orgs that can't be expected to match.{' '}
        <strong>Platform invoices</strong> reflect every <code>PlatformInvoice</code> in
        the window; in production milestone-1 those are equivalent to both-sided since{' '}
        <code>InvoicerService</code> only generates platform invoices for orgs with a{' '}
        <code>Contract</code> (which already have a legacy counterpart). The table
        compares the migrated orgs, sorted by absolute % delta (relative to legacy),
        largest first.
      </p>

      <Panel>
        <PanelHeader>Query</PanelHeader>
        <PanelBody withPadding>
          <Flex gap="md" align="end" wrap="wrap">
            <Stack gap="xs">
              <FieldLabel>Region</FieldLabel>
              <CompactSelect
                trigger={triggerProps => (
                  <OverlayTrigger.Button {...triggerProps} prefix="Region" />
                )}
                value={cell?.name ?? ''}
                options={cells.map(c => ({label: c.name, value: c.name}))}
                onChange={opt => setQueryRegion(opt.value)}
              />
            </Stack>
            <Stack gap="xs">
              <FieldLabel htmlFor="start">First day (UTC)</FieldLabel>
              <Input
                id="start"
                type="date"
                value={startInput}
                onChange={e => setStartInput(e.target.value)}
              />
            </Stack>
            <Stack gap="xs">
              <FieldLabel htmlFor="end">Last day (UTC)</FieldLabel>
              <Input
                id="end"
                type="date"
                value={endInput}
                onChange={e => setEndInput(e.target.value)}
              />
            </Stack>
            <Stack gap="xs">
              <FieldLabel>Results per page</FieldLabel>
              <CompactSelect
                trigger={triggerProps => (
                  <OverlayTrigger.Button {...triggerProps} prefix="Per page" />
                )}
                value={String(pageSize)}
                options={PAGE_SIZE_OPTIONS.map(n => ({
                  label: String(n),
                  value: String(n),
                }))}
                onChange={opt => setPageSize(Number(opt.value))}
              />
            </Stack>
            <Button variant="primary" onClick={onSubmit} disabled={!cell}>
              Run comparison
            </Button>
          </Flex>
        </PanelBody>
      </Panel>

      {/* isPending stays true while the query is skipped (no cell, or a
          one-sided window), which would spin forever. */}
      {isLoading && <LoadingIndicator>Comparing…</LoadingIndicator>}

      {isError && (
        <Alert.Container>
          <Alert variant="danger">
            Failed to load comparison
            {(error as any)?.responseJSON?.detail
              ? `: ${(error as any).responseJSON.detail}`
              : ''}
            .
          </Alert>
        </Alert.Container>
      )}

      {data && (
        <Fragment>
          <Panel>
            <PanelHeader>Summary</PanelHeader>
            <PanelBody withPadding>
              <Grid columns={{zero: 'repeat(2, 1fr)', '2xl': 'repeat(3, 1fr)'}} gap="xl">
                <Stack>
                  <Text size="sm" variant="muted">
                    Legacy invoices
                  </Text>
                  <Text size="lg" bold>
                    {formatCountOrNA(data.summary.legacy_count)}
                  </Text>
                </Stack>
                <Stack>
                  <Text size="sm" variant="muted">
                    Platform invoices
                  </Text>
                  <Text size="lg" bold>
                    {formatCountOrNA(data.summary.platform_count)}
                  </Text>
                </Stack>
                <Stack>
                  <Text size="sm" variant="muted">
                    {'>1% diff'}
                  </Text>
                  <Text size="lg" bold>
                    {formatPercentOrNA(data.summary.over_threshold_pct)}
                    <TruncatedNote size="sm" variant="muted">
                      ({formatCountOrNA(data.summary.over_threshold_count)} of{' '}
                      {formatCountOrNA(data.summary.row_count)})
                    </TruncatedNote>
                  </Text>
                </Stack>
              </Grid>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              Rows (sorted by |delta|, biggest first) — queried {data.summary.queried_at}
            </PanelHeader>
            <PanelBody>
              <Paginator
                page={data.summary.rows_page}
                totalPages={data.summary.rows_total_pages}
                total={data.summary.row_count}
                pageSize={data.summary.rows_page_size}
                onChange={setRowsPage}
              />
              <Table>
                <thead>
                  <tr>
                    <th>Organization</th>
                    <RightHeader>Legacy</RightHeader>
                    <RightHeader>Platform</RightHeader>
                    <RightHeader>Δ %</RightHeader>
                    <RightHeader>Δ $</RightHeader>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <em>No invoices in this range on either side.</em>
                      </td>
                    </tr>
                  )}
                  {rows.map(row => (
                    <tr key={row.organization_id}>
                      <td>
                        {row.organization_slug ? (
                          <Link to={`/_admin/customers/${row.organization_slug}/`}>
                            {row.organization_slug}
                          </Link>
                        ) : (
                          <span>org#{row.organization_id}</span>
                        )}
                      </td>
                      <RightCell>
                        <InvoiceAmount
                          cents={row.legacy_amount}
                          guid={row.legacy_invoice_guid}
                          region={cell?.name}
                        />{' '}
                        <Text size="sm" variant="muted">
                          ({row.legacy_invoice_count})
                        </Text>
                      </RightCell>
                      <RightCell>
                        <InvoiceAmount
                          cents={row.platform_amount}
                          guid={row.platform_invoice_guid}
                          region={cell?.name}
                        />{' '}
                        <Text size="sm" variant="muted">
                          ({row.platform_invoice_count})
                        </Text>
                      </RightCell>
                      <RightCell>{formatPercent(row.delta_pct)}</RightCell>
                      <RightCell>{formatDollars(row.delta_cents)}</RightCell>
                      <td>
                        <Tag variant={STATUS_VARIANT[row.status]}>{row.status}</Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </PanelBody>
          </Panel>
        </Fragment>
      )}
    </Fragment>
  );
}

function Paginator({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  onChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}) {
  // Empty result set: nothing to page through. Render the row count anyway
  // so the table doesn't look like it's missing its header.
  if (totalPages <= 1) {
    return (
      <Flex justify="between" align="center" padding="md lg" borderBottom="primary">
        <Text size="sm" variant="muted">
          {total === 0 ? 'No rows' : `${total} row${total === 1 ? '' : 's'}`}
        </Text>
      </Flex>
    );
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <Flex justify="between" align="center" padding="md lg" borderBottom="primary">
      <Text size="sm" variant="muted">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()} · page{' '}
        {page} of {totalPages}
      </Text>
      <Flex gap="xs">
        <Button size="xs" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Prev
        </Button>
        <Button
          size="xs"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </Flex>
    </Flex>
  );
}

const FieldLabel = styled('label')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const TruncatedNote = styled(Text)`
  margin-left: 8px;
`;

const Table = styled('table')`
  width: 100%;
  border-collapse: collapse;
  th,
  td {
    padding: 8px 12px;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    text-align: left;
  }
  th {
    font-weight: 600;
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

// The Table descendant rule above (\`th, td { text-align: left }\`) has
// specificity (0,1,1) which would otherwise beat these single-class
// selectors. Emotion's && doubles the class to (0,2,0) so the right-align
// wins. See https://emotion.sh/docs/styled#styling-any-component.
const RightHeader = styled('th')`
  && {
    text-align: right;
  }
`;

const RightCell = styled('td')`
  && {
    text-align: right;
  }
`;
