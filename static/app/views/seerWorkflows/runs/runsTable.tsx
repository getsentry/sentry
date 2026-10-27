import {IconProject} from '@sentry/icons/project';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {StatusIcon} from 'sentry/views/seerWorkflows/runs/statusIcon';
import {useWorkflowRuns} from 'sentry/views/seerWorkflows/runs/useWorkflowRuns';
import {getWorkflowStatus} from 'sentry/views/seerWorkflows/strategies';
import type {SeerWorkflowRun} from 'sentry/views/seerWorkflows/types';

const COLUMNS: TableColumnConfig[] = [
  {key: 'status', width: 'min-content'},
  {key: 'id', width: 'max-content'},
  {key: 'date', width: 'max-content'},
  {key: 'output', width: '1fr'},
  {key: 'trigger', width: 'max-content'},
  {key: 'usage', width: 'max-content'},
];

// TODO: Missing fields from backend - to add to runs API
type AdditionalRunProps = {
  /**
   * Estimated cost of the run, in US dollars
   */
  cost?: number;
  /**
   * What the run produced, e.g. an investigation
   */
  output?: {text: string; to?: string};
  /**
   * Tokens used by the run
   */
  tokens?: number;
  /**
   * What started the run, e.g. an issue
   */
  trigger?: {text: string; to?: string};
};

type RunRow = SeerWorkflowRun & AdditionalRunProps;

function makePlaceholderRun(
  id: string,
  dateAdded: string,
  overrides: Partial<AdditionalRunProps>
): RunRow {
  return {
    id,
    dateAdded,
    dateCompleted: dateAdded,
    errorMessage: null,
    results: [],
    source: 'cron',
    strategy: 'breached_metrics',
    extras: {status: 'complete'},
    ...overrides,
  };
}

/**
 * Placeholders for run details the runs endpoint doesn't return yet
 */
const PLACEHOLDER_RUNS: RunRow[] = [
  makePlaceholderRun('placeholder-267555', '2026-10-22T17:15:00Z', {
    output: {text: 'INV-0473 | Payment capture failures after provider change'},
    trigger: {text: 'CHECKOUT-API-1MQ'},
    tokens: 112_400,
    cost: 0.18,
  }),
  makePlaceholderRun('placeholder-2152', '2026-10-22T16:00:00Z', {
    output: {text: '2 Investigations'},
    trigger: {text: 'BACKEND-4388', to: '/issues/'},
    tokens: 351_800,
    cost: 1.75,
  }),
  makePlaceholderRun('placeholder-2415', '2026-10-22T02:14:00Z', {
    trigger: {text: 'CHECKOUT-API-1J2'},
    tokens: 22_400,
    cost: 0.04,
  }),
];

export function RunsTable() {
  const {runs: apiRuns, isPending, isError, refetch} = useWorkflowRuns();

  const runs: RunRow[] = [...PLACEHOLDER_RUNS, ...apiRuns].toSorted(
    (a, b) => Date.parse(b.dateAdded) - Date.parse(a.dateAdded)
  );

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }
  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <SimpleTable
      columns={COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('ID')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Date')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Output')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Trigger')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Tokens | Cost')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {runs.length === 0 ? (
        <SimpleTable.Empty>{t('No runs yet.')}</SimpleTable.Empty>
      ) : (
        runs.map(run => (
          <SimpleTable.Row key={run.id}>
            <SimpleTable.RowCell>
              <StatusIcon status={getWorkflowStatus(run)} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text size="sm">{run.id}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text size="sm">
                <DateTime date={run.dateAdded} format="MMM D HH:mm" utc timeZone />
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <LinkOrText value={run.output} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {run.trigger ? (
                <Flex align="center" gap="xs">
                  <IconProject size="xs" variant="muted" />
                  <LinkOrText value={run.trigger} />
                </Flex>
              ) : (
                <EmptyValue />
              )}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text size="sm">{formatUsage(run)}</Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))
      )}
    </SimpleTable>
  );
}

function LinkOrText({value}: {value?: {text: string; to?: string}}) {
  if (!value) {
    return <EmptyValue />;
  }
  if (value.to) {
    return (
      <Link to={value.to}>
        <Text size="sm" variant="inherit">
          {value.text}
        </Text>
      </Link>
    );
  }
  return (
    <Text size="sm" variant="muted">
      {value.text}
    </Text>
  );
}

function EmptyValue() {
  return (
    <Text size="sm" variant="muted">
      {'—'}
    </Text>
  );
}

function formatUsage({tokens, cost}: RunRow) {
  if (tokens === undefined && cost === undefined) {
    return '—';
  }
  const parts = [
    tokens === undefined ? '—' : formatAbbreviatedNumber(tokens, undefined, true),
    cost === undefined
      ? '—'
      : cost.toLocaleString(undefined, {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 3,
        }),
  ];
  return parts.join(' | ');
}
