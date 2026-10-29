import {Fragment} from 'react';

import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useAutomationRuns} from 'sentry/views/seerWorkflows/automations/hooks/useAutomationRuns';
import {
  getRunDisplayStatus,
  StatusIcon,
} from 'sentry/views/seerWorkflows/automations/runs/statusIcon';
import {getStrategyLabel} from 'sentry/views/seerWorkflows/strategies';
import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

const COLUMNS: TableColumnConfig[] = [
  {key: 'status', width: 'min-content'},
  {key: 'id', width: 'max-content'},
  {key: 'date', width: 'max-content'},
  {key: 'strategy', width: '1fr'},
];

/**
 * Pass `configId` to only show one automation's runs
 */
export function RunsTable({configId}: {configId?: string}) {
  const location = useLocation();
  const {runs, pageLinks, isPending, isError, refetch} = useAutomationRuns({
    configId,
    cursor: decodeScalar(location.query.cursor),
  });

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <Fragment>
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('ID')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Date')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Strategy')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending ? (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        ) : runs.length === 0 ? (
          <SimpleTable.Empty>{t('No runs yet.')}</SimpleTable.Empty>
        ) : (
          runs.map(run => <RunRow key={run.id} run={run} />)
        )}
      </SimpleTable>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

function RunRow({run}: {run: SeerAutomationRun}) {
  const status = getRunDisplayStatus(run.status);
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        {status ? <StatusIcon status={status} /> : <Text variant="muted">{'—'}</Text>}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text variant="muted">{run.id}</Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Tooltip
          title={<TimeSince date={run.dateAdded} disabledAbsoluteTooltip />}
          showUnderline
        >
          <DateTime date={run.dateAdded} timeZone />
        </Tooltip>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text>{getStrategyLabel(run.strategy)}</Text>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
