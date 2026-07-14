import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import moment from 'moment-timezone';
import Papa from 'papaparse';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import type {DataCategoryExact} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getCells} from 'sentry/utils/cells';
import {useApiQuery} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

import {PageHeader} from 'admin/components/pageHeader';

// Categories that can carry recurring EVENT credits. Mirrors
// CreditType.data_types() in getsentry/models/recurringcredit.py, keyed by the
// category's name_singular from /billing-config/.
const GIFTABLE_CATEGORIES = new Set([
  'error',
  'transaction',
  'span',
  'profile_duration',
  'profile_duration_ui',
  'attachment',
  'replay',
  'log_byte',
  'seer_user',
  'trace_metric_byte',
]);

const MAX_BILLING_PERIODS = 24;

// Display-unit handling: admins enter GB for byte categories and hours for
// continuous profiling; the backend takes raw storage units and applies no
// multiplier of its own, so the conversion happens here, mirroring the
// server-side gift flow's get_category_value_with_multiplier.
function categoryFormatting(nameSingular: string) {
  const info = DATA_CATEGORY_INFO[nameSingular as DataCategoryExact];
  const unitType = info?.formatting.unitType ?? 'count';
  return {
    multiplier: info?.formatting.reservedMultiplier ?? 1,
    unitLabel:
      unitType === 'bytes' ? 'GB' : unitType === 'durationHours' ? 'hours' : 'count',
    isCount: unitType === 'count',
  };
}

// Renders a gift as "<amount>/mo ×<periods> (<start> → <end>)". The window
// spans exactly `periods` monthly billing periods (end = start + N months).
function formatGiftSummary(
  displayAmount: number,
  periodStart: string,
  periodEnd: string,
  isCount: boolean,
  unitLabel: string
) {
  const periods = Math.round(moment(periodEnd).diff(moment(periodStart), 'months', true));
  const amount = isCount
    ? displayAmount.toLocaleString()
    : `${displayAmount} ${unitLabel}`;
  return `${amount}/mo ×${periods} (${moment(periodStart).format('ll')} → ${moment(
    periodEnd
  ).format('ll')})`;
}

interface CategoryInfo {
  api_name: string;
  billed_category: number | null;
  display_name: string;
  name: string;
  name_singular: string;
  order: number;
}

interface BillingConfig {
  category_info: Record<string, CategoryInfo>;
}

interface ResultRow {
  code: string | null;
  creditId: number | null;
  id: number | null;
  periodEnd: string | null;
  periodStart: string | null;
  // The org's plan id (e.g. "am3_team"); null when no subscription resolved.
  plan: string | null;
  slug: string | null;
  status: string;
}

function downloadResultsCsv(results: ResultRow[]) {
  const csv = Papa.unparse(
    results.map(row => ({
      org_id: row.id ?? '',
      org_slug: row.slug ?? '',
      plan: row.plan ?? '',
      status: row.status,
      code: row.code ?? '',
      period_start: row.periodStart ?? '',
      period_end: row.periodEnd ?? '',
      credit_id: row.creditId ?? '',
    }))
  );
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gift-recurring-credits-results.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function GiftRecurringCredits() {
  const [dataCategory, setDataCategory] = useState('replay');
  const [amount, setAmount] = useState<number | null>(null);
  const [billingPeriods, setBillingPeriods] = useState<number | null>(3);
  const [orgTokens, setOrgTokens] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  // The region and per-period amount the last results were submitted with,
  // captured at submit time so the callout and the "new gift" column stay
  // accurate even if the form changes afterward.
  const [resultsRegion, setResultsRegion] = useState<string | null>(null);
  const [resultsAmount, setResultsAmount] = useState(0);
  const [resultsCategory, setResultsCategory] = useState('replay');
  const inputFileRef = useRef<HTMLInputElement>(null);
  const cells = getCells();
  const [cell, setCell] = useState(cells[0] ?? null);

  // The default api client forces a JSON Content-Type, which can't carry a
  // multipart upload. This bespoke client omits Content-Type so the browser
  // sets the multipart boundary itself.
  const api = useApi({
    api: new Client({headers: {Accept: 'application/json; charset=utf-8'}}),
  });

  const userPermissions = ConfigStore.get('user')?.permissions;
  const hasBillingAdmin = !!userPermissions?.has?.('billing.admin');

  const {data: billingConfig} = useApiQuery<BillingConfig>(
    [getApiUrl('/billing-config/')],
    {staleTime: Infinity}
  );

  const categoryOptions = useMemo(() => {
    if (!billingConfig) {
      return [];
    }
    return Object.entries(billingConfig.category_info)
      .filter(
        ([key, info]) =>
          info.billed_category !== null &&
          Number(key) === info.billed_category &&
          GIFTABLE_CATEGORIES.has(info.name_singular)
      )
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([, info]) => ({
        label: info.display_name,
        value: info.name_singular,
      }));
  }, [billingConfig]);

  // Orgs the backend couldn't find in the region the request was sent to. They
  // may live in another region; the operator can re-run them there.
  const notInRegionOrgs = (results ?? []).filter(
    row => row.status === 'error' && row.code === 'unknown-org'
  );
  const notInRegionLabel =
    notInRegionOrgs
      .slice(0, 20)
      .map(row => row.slug ?? row.id)
      .join(', ') +
    (notInRegionOrgs.length > 20 ? `, and ${notInRegionOrgs.length - 20} more` : '');

  const {multiplier, unitLabel, isCount} = categoryFormatting(dataCategory);

  // Formatting for the results table uses the category the request was
  // submitted with, not whatever the dropdown shows now.
  const resultsFormatting = categoryFormatting(resultsCategory);

  const selectedCategoryLabel =
    categoryOptions.find(option => option.value === dataCategory)?.label ?? dataCategory;

  const amountText =
    amount === null
      ? 'The gifted amount'
      : isCount
        ? `${amount.toLocaleString()} ${selectedCategoryLabel.toLowerCase()}`
        : `${amount} ${unitLabel}`;

  const schedule = useMemo(() => {
    if (
      billingPeriods === null ||
      !Number.isInteger(billingPeriods) ||
      billingPeriods < 1 ||
      billingPeriods > MAX_BILLING_PERIODS
    ) {
      return null;
    }
    const row = (index: number) => {
      return {
        key: index,
        when:
          index === 0
            ? 'This billing period'
            : index === 1
              ? 'Next billing period'
              : `About ${index} months from now`,
        detail:
          index === 0
            ? 'starts now, applied immediately'
            : index === billingPeriods - 1
              ? 'the last gifted period'
              : '',
      };
    };
    // Keep the list short for large gifts: show the first few periods and the
    // last, with an honest count of what's collapsed in between.
    if (billingPeriods <= 5) {
      return {
        rows: Array.from({length: billingPeriods}, (_, index) => row(index)),
        hiddenCount: 0,
        tailRow: null,
      };
    }
    return {
      rows: [row(0), row(1), row(2)],
      hiddenCount: billingPeriods - 4,
      tailRow: row(billingPeriods - 1),
    };
  }, [billingPeriods]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!/\.csv$/i.test(file.name)) {
      if (inputFileRef.current) {
        inputFileRef.current.value = '';
      }
      // A rejected reselection must not leave an earlier valid file staged, or
      // that stale file would be the one POSTed.
      setCsvFile(null);
      setCsvFileName(null);
      addErrorMessage('Please upload a .csv file.');
      return;
    }
    setCsvFile(file);
    setCsvFileName(file.name);
  };

  const {mutate, isPending} = useMutation({
    // Clear any prior results up front so a run that fails can't leave the
    // previous run's table and warnings on screen next to the error toast.
    onMutate: () => setResults(null),
    mutationFn: async () => {
      const region = cell?.name ?? null;
      const submittedAmount = amount ?? 0;
      const formData = new FormData();
      if (csvFile) {
        formData.append('file', csvFile);
      }
      if (orgTokens.trim()) {
        formData.append('orgsTokens', orgTokens);
      }
      formData.append('dataCategory', dataCategory);
      formData.append('amount', String(Math.round((amount ?? 0) * multiplier)));
      formData.append('billingPeriods', String(billingPeriods));
      const response: {results: ResultRow[]} = await api.requestPromise(
        `/_admin/cells/${cell?.name}/gift-recurring-credits/`,
        {
          method: 'POST',
          host: cell?.locality_url,
          data: formData,
        }
      );
      return {
        ...response,
        region,
        submittedAmount,
        category: dataCategory,
      };
    },
    onSuccess: response => {
      setResults(response.results);
      setResultsRegion(response.region);
      setResultsAmount(response.submittedAmount);
      setResultsCategory(response.category);
      const errors = response.results.filter(row => row.status === 'error').length;
      if (errors > 0) {
        addErrorMessage(
          `Gifting finished: ${errors} of ${response.results.length} orgs failed.`
        );
      } else {
        addSuccessMessage(`Gifted recurring credits to ${response.results.length} orgs.`);
      }
    },
    onError: (error: unknown) => {
      // Surface the backend's own message (e.g. the org-count cap, which the
      // backend serializer is the single source of truth for) rather than a
      // generic failure.
      let detail: string | undefined;
      if (error instanceof RequestError) {
        const orgsError = error.responseJSON?.orgs;
        if (Array.isArray(orgsError) && typeof orgsError[0] === 'string') {
          detail = orgsError[0];
        } else if (typeof error.responseJSON?.detail === 'string') {
          detail = error.responseJSON.detail;
        }
      }
      addErrorMessage(detail ?? 'Gift recurring credits request failed.');
    },
  });

  const canSubmit =
    hasBillingAdmin &&
    !isPending &&
    cell !== null &&
    (csvFile !== null || orgTokens.trim().length > 0) &&
    amount !== null &&
    amount > 0 &&
    // Count categories are whole units, and the POST rounds the amount; block a
    // fractional count so the submitted value always matches what's previewed.
    (!isCount || Number.isInteger(amount)) &&
    Math.round(amount * multiplier) > 0 &&
    billingPeriods !== null &&
    Number.isInteger(billingPeriods) &&
    billingPeriods >= 1 &&
    billingPeriods <= MAX_BILLING_PERIODS;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Mirror the button's disabled state so a submit that slips past it (a
    // rapid double-click before isPending re-renders) can't fire a second POST.
    if (!canSubmit) {
      return;
    }
    mutate();
  };

  return (
    <div>
      <PageHeader title="Gift Recurring Credits" />
      {!hasBillingAdmin && <Warning>Requires billing admin permissions.</Warning>}
      <Column onSubmit={handleSubmit}>
        <p>
          Gift free volume for a data category to one or more organizations. The
          organization gets the volume right away and again at the start of each billing
          period, for the number of periods you choose below. Only organizations on legacy
          billing can be gifted this way.
        </p>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Region" />
          )}
          value={cell ? cell.locality_url : undefined}
          options={cells.map(c => ({
            label: c.name,
            value: c.locality_url,
          }))}
          onChange={option => {
            const cellOption = cells.find(c => c.locality_url === option.value);
            if (cellOption !== undefined) {
              setCell(cellOption);
            }
          }}
        />
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Data Category" />
          )}
          value={dataCategory}
          options={categoryOptions}
          onChange={option => setDataCategory(option.value)}
        />
        <label htmlFor="amount">Amount per billing period ({unitLabel}):</label>
        <NarrowInput
          type="number"
          id="amount"
          name="amount"
          min={isCount ? 1 : 0}
          step={isCount ? 1 : 'any'}
          value={amount === null ? '' : amount}
          onChange={e => setAmount(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={isCount ? '5000' : '5'}
        />
        <label htmlFor="billingPeriods">How many monthly billing periods?</label>
        <NarrowInput
          type="number"
          id="billingPeriods"
          name="billingPeriods"
          min={1}
          max={MAX_BILLING_PERIODS}
          step={1}
          value={billingPeriods === null ? '' : billingPeriods}
          onChange={e =>
            setBillingPeriods(e.target.value === '' ? null : Number(e.target.value))
          }
        />
        {schedule && (
          <PreviewBox data-test-id="schedule-preview">
            <PreviewSummary>
              {amountText} every billing period, for {billingPeriods} monthly period
              {billingPeriods === 1 ? '' : 's'}.
            </PreviewSummary>
            <PreviewNote>
              The current billing period is already in progress — the organization gets
              the full amount for it right away, then again when each of the periods below
              begins.
            </PreviewNote>
            <PreviewList>
              {schedule.rows.map(row => (
                <li key={row.key}>
                  <PreviewWhen>{row.when}</PreviewWhen>
                  {row.detail ? <PreviewDetail> — {row.detail}</PreviewDetail> : null}
                </li>
              ))}
              {schedule.hiddenCount > 0 && (
                <PreviewEllipsis>
                  …and {schedule.hiddenCount} more monthly period
                  {schedule.hiddenCount === 1 ? '' : 's'}
                </PreviewEllipsis>
              )}
              {schedule.tailRow && (
                <li key={schedule.tailRow.key}>
                  <PreviewWhen>{schedule.tailRow.when}</PreviewWhen>
                  {schedule.tailRow.detail ? (
                    <PreviewDetail> — {schedule.tailRow.detail}</PreviewDetail>
                  ) : null}
                </li>
              )}
            </PreviewList>
            <PreviewNote>
              Every billing period after these {billingPeriods} gets nothing — the gift is
              not permanent.
            </PreviewNote>
            <PreviewNote data-test-id="no-rollover-note">
              Unused credits don't roll over — each billing period gets the full amount
              fresh, and whatever isn't used that period is lost.
            </PreviewNote>
          </PreviewBox>
        )}
        <label htmlFor="orgs">
          Target organizations (ids and/or slugs, separated by commas or newlines —
          numeric tokens are treated as org ids):
        </label>
        <OrgTextarea
          id="orgs"
          name="orgs"
          rows={4}
          value={orgTokens}
          onChange={e => setOrgTokens(e.target.value)}
          placeholder={'12345\nacme-corp'}
        />
        <UploadRow>
          <UploadInput
            name="csv"
            type="file"
            aria-label="csv-upload"
            accept=".csv"
            ref={inputFileRef}
            onChange={handleFileChange}
            hidden
          />
          <Button size="xs" onClick={() => inputFileRef.current?.click()}>
            Upload CSV
          </Button>
          {csvFileName ? (
            <span>
              {csvFileName}{' '}
              <Button
                size="xs"
                variant="link"
                aria-label="clear-csv"
                onClick={() => {
                  setCsvFile(null);
                  setCsvFileName(null);
                  if (inputFileRef.current) {
                    inputFileRef.current.value = '';
                  }
                }}
              >
                clear
              </Button>
            </span>
          ) : (
            <UploadHint>
              CSV with an <code>org_id</code> and/or <code>org_slug</code> column (org id
              wins when both are set).
            </UploadHint>
          )}
        </UploadRow>
        <Button
          variant="primary"
          type="submit"
          disabled={!canSubmit}
          data-test-id="gift-submit"
        >
          Gift Credits
        </Button>
      </Column>
      {results && (
        <ResultsSection data-test-id="results">
          <h4>Results</h4>
          {notInRegionOrgs.length > 0 && (
            <Alert.Container>
              <Alert
                variant="warning"
                showIcon={false}
                data-test-id="not-in-region-warning"
              >
                {notInRegionOrgs.length} of {results.length} orgs were not found in the{' '}
                {resultsRegion ?? 'selected'} region and were not processed:{' '}
                {notInRegionLabel}. If they belong to a different region, re-run this tool
                with that region selected.
              </Alert>
            </Alert.Container>
          )}
          <Button size="xs" onClick={() => downloadResultsCsv(results)}>
            Download results CSV
          </Button>
          <ResultsTable>
            <thead>
              <tr>
                <th>Org ID</th>
                <th>Org Slug</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Code</th>
                <th>New gift</th>
                <th>Credit ID</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, index) => {
                return (
                  <tr key={index}>
                    <td>{row.id ?? '—'}</td>
                    <td>
                      {row.slug ? (
                        <Link to={`/_admin/customers/${row.slug}/`}>{row.slug}</Link>
                      ) : (
                        (row.id ?? '—')
                      )}
                    </td>
                    <td>{row.plan ?? '—'}</td>
                    <td>{row.status}</td>
                    <td>{row.code ?? '—'}</td>
                    <td>
                      {row.status === 'error' || !row.periodStart || !row.periodEnd
                        ? '—'
                        : formatGiftSummary(
                            resultsAmount,
                            row.periodStart,
                            row.periodEnd,
                            resultsFormatting.isCount,
                            resultsFormatting.unitLabel
                          )}
                    </td>
                    <td>{row.creditId ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </ResultsTable>
        </ResultsSection>
      )}
    </div>
  );
}

const Column = styled('form')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  > * {
    margin: 0;
  }
  > button {
    width: fit-content;
  }
`;

const Warning = styled('p')`
  color: ${p => p.theme.tokens.content.danger};
  font-weight: bold;
`;

const NarrowInput = styled(Input)`
  width: 200px;
`;

const PreviewBox = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.secondary};
`;

const PreviewSummary = styled('div')`
  font-weight: bold;
`;

const PreviewNote = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const PreviewList = styled('ol')`
  margin: 0;
  padding-left: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const PreviewWhen = styled('span')`
  font-weight: bold;
`;

const PreviewDetail = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const PreviewEllipsis = styled('li')`
  list-style: none;
  color: ${p => p.theme.tokens.content.secondary};
`;

const OrgTextarea = styled('textarea')`
  font-family: ${p => p.theme.font.family.mono};
  padding: ${p => p.theme.space.sm};
`;

const UploadInput = styled('input')`
  position: absolute;
  opacity: 0;
`;

const UploadRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const UploadHint = styled('span')`
  font-size: ${p => p.theme.font.size.sm};
`;

const ResultsSection = styled('div')`
  margin-top: ${p => p.theme.space.xl};
`;

const ResultsTable = styled('table')`
  width: 100%;
  margin-top: ${p => p.theme.space.md};

  th,
  td {
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
    text-align: left;
  }
`;
