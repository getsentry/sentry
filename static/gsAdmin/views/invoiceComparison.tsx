import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {ConfigStore} from 'sentry/stores/configStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';

type RowStatus = 'match' | 'mismatch' | 'legacy_only' | 'platform_only';

type Row = {
  delta_cents: number;
  delta_pct: number | null;
  legacy_amount: number | null;
  legacy_invoice_count: number;
  organization_id: number;
  organization_slug: string | null;
  platform_amount: number | null;
  platform_invoice_count: number;
  status: RowStatus;
};

type Summary = {
  end: string;
  legacy_count: number;
  legacy_total_cents: number;
  platform_count: number;
  platform_total_cents: number;
  queried_at: string;
  row_count: number;
  start: string;
  truncated: boolean;
};

type ComparisonResponse = {rows: Row[]; summary: Summary};

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

function formatPercent(pct: number | null) {
  if (pct === null) {
    // No legacy baseline — sorts to top of the list.
    return <em>∞</em>;
  }
  return `${(pct * 100).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`;
}

// `datetime-local` inputs use the user's local timezone with no offset
// in the string (e.g. "2026-05-26T22:30"). Format a Date for that field.
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function nowLocal(): string {
  return toDatetimeLocalValue(new Date());
}

function hoursAgoLocal(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return toDatetimeLocalValue(d);
}

// `datetime-local` value is local time without offset; convert to a UTC ISO
// string so the server interprets it unambiguously.
function localInputToUtcIso(value: string): string {
  return new Date(value).toISOString();
}

export function InvoiceComparison() {
  const regions = ConfigStore.get('regions');
  const [region, setRegion] = useState(regions[0] ?? null);
  const [startInput, setStartInput] = useState(hoursAgoLocal(24));
  const [endInput, setEndInput] = useState(nowLocal());
  const [submitted, setSubmitted] = useState<{end: string; start: string} | null>(null);

  const enabled = Boolean(submitted && region);
  const {data, isPending, isError, error} = useQuery({
    ...apiOptions.as<ComparisonResponse>()('/_admin/cells/$region/invoice-comparison/', {
      path: enabled && region ? {region: region.name} : skipToken,
      host: region?.url,
      query: submitted ?? undefined,
      staleTime: 0,
    }),
  });

  // The endpoint returns rows pre-sorted by |delta_pct| desc; this component
  // does not re-sort. See AdminInvoiceComparisonEndpoint and its test_sort_*
  // tests for the contract.
  const rows = data?.rows ?? [];

  const onSubmit = () => {
    if (!startInput || !endInput) {
      return;
    }
    setSubmitted({
      start: localInputToUtcIso(startInput),
      end: localInputToUtcIso(endInput),
    });
  };

  return (
    <Fragment>
      <p>
        Per-org totals comparing legacy <code>Invoice</code> and shadow{' '}
        <code>PlatformInvoice</code> records <strong>generated</strong> in the selected
        window (filtered on <code>date_added</code>, your local time — converted to UTC on
        submit). Only orgs that have invoices on <strong>both</strong> sides in the window
        appear in the table; one-sided orgs are excluded from rows but counted in the
        summary above. All invoices for an org are summed on each side with a count shown
        in parentheses. Sorted by absolute % delta (relative to legacy), largest first —
        rows where the percentage is undefined (legacy=$0 with non-zero platform) sort to
        the top as ∞.
      </p>

      <Panel>
        <PanelHeader>Query</PanelHeader>
        <PanelBody withPadding>
          <Flex gap="md" align="end" wrap="wrap">
            <Flex direction="column" gap="xs">
              <FieldLabel>Region</FieldLabel>
              <CompactSelect
                trigger={triggerProps => (
                  <OverlayTrigger.Button {...triggerProps} prefix="Region" />
                )}
                value={region?.url ?? ''}
                options={regions.map((r: any) => ({label: r.name, value: r.url}))}
                onChange={opt => {
                  setRegion(regions.find((r: any) => r.url === opt.value) ?? null);
                }}
              />
            </Flex>
            <Flex direction="column" gap="xs">
              <FieldLabel htmlFor="start">Generated since (local)</FieldLabel>
              <Input
                id="start"
                type="datetime-local"
                value={startInput}
                onChange={e => setStartInput(e.target.value)}
              />
            </Flex>
            <Flex direction="column" gap="xs">
              <FieldLabel htmlFor="end">Generated until (local)</FieldLabel>
              <Input
                id="end"
                type="datetime-local"
                value={endInput}
                onChange={e => setEndInput(e.target.value)}
              />
            </Flex>
            <Button variant="primary" onClick={onSubmit} disabled={!region}>
              Run comparison
            </Button>
          </Flex>
        </PanelBody>
      </Panel>

      {submitted && isPending && <LoadingIndicator>Comparing…</LoadingIndicator>}

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
              <Grid
                columns="repeat(6, 1fr)"
                gap="xl"
                css={css`
                  @media (max-width: 900px) {
                    grid-template-columns: repeat(3, 1fr);
                  }
                `}
              >
                <Flex direction="column">
                  <Text size="sm" variant="muted">
                    Legacy invoices
                  </Text>
                  <Text size="lg" bold>
                    {data.summary.legacy_count}
                  </Text>
                </Flex>
                <Flex direction="column">
                  <Text size="sm" variant="muted">
                    Platform invoices
                  </Text>
                  <Text size="lg" bold>
                    {data.summary.platform_count}
                  </Text>
                </Flex>
                <Flex direction="column">
                  <Text size="sm" variant="muted">
                    Legacy total
                  </Text>
                  <Text size="lg" bold>
                    {formatDollars(data.summary.legacy_total_cents)}
                  </Text>
                </Flex>
                <Flex direction="column">
                  <Text size="sm" variant="muted">
                    Platform total
                  </Text>
                  <Text size="lg" bold>
                    {formatDollars(data.summary.platform_total_cents)}
                  </Text>
                </Flex>
                <Flex direction="column">
                  <Text size="sm" variant="muted">
                    Total delta
                  </Text>
                  <Text size="lg" bold>
                    {formatDollars(
                      data.summary.legacy_total_cents - data.summary.platform_total_cents
                    )}
                  </Text>
                </Flex>
                <Flex direction="column">
                  <Text size="sm" variant="muted">
                    Rows
                  </Text>
                  <Text size="lg" bold>
                    {data.summary.row_count}
                    {data.summary.truncated && (
                      <TruncatedNote size="sm" variant="muted">
                        (showing top {data.rows.length})
                      </TruncatedNote>
                    )}
                  </Text>
                </Flex>
              </Grid>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              Rows (sorted by |delta|, biggest first) — queried {data.summary.queried_at}
            </PanelHeader>
            <PanelBody>
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
                        {formatDollars(row.legacy_amount)}{' '}
                        <Text size="sm" variant="muted">
                          ({row.legacy_invoice_count})
                        </Text>
                      </RightCell>
                      <RightCell>
                        {formatDollars(row.platform_amount)}{' '}
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
