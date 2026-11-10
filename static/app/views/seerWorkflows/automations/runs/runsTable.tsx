import {Fragment} from 'react';
import {IconIssues} from '@sentry/icons/issues';
import upperFirst from 'lodash/upperFirst';
import {useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
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
import {useOrganization} from 'sentry/utils/useOrganization';
import {getInvestigationPath} from 'sentry/views/investigations/utils';
import {useAutomationRuns} from 'sentry/views/seerWorkflows/automations/hooks/useAutomationRuns';
import {getStrategyLabel} from 'sentry/views/seerWorkflows/strategies';
import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

import {getRunDisplayStatus, StatusIcon} from './statusIcon';

const COLUMNS: TableColumnConfig[] = [
  {key: 'status', width: 'min-content'},
  {key: 'id', width: 'max-content'},
  {key: 'date', width: 'max-content'},
  {key: 'output', width: '1fr'},
  {key: 'trigger', width: '1fr'},
];

/**
 * Pass `configId` to only show one automation's runs. Pass `showStrategy={false}` to
 * leave the strategy out of the trigger column, e.g. when the page is already scoped
 * to one automation.
 */
export function RunsTable({
  configId,
  showStrategy = true,
}: {
  configId?: string;
  showStrategy?: boolean;
}) {
  const [cursor] = useQueryState('cursor');
  const {runs, pageLinks, isPending, isLoadingError, refetch} = useAutomationRuns({
    configId,
    cursor: cursor || undefined,
  });

  if (isLoadingError) {
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
            <SimpleTable.HeaderCell>{t('Output')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Trigger')}</SimpleTable.HeaderCell>
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
          runs.map(run => <RunRow key={run.id} run={run} showStrategy={showStrategy} />)
        )}
      </SimpleTable>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

function RunRow({run, showStrategy}: {run: SeerAutomationRun; showStrategy: boolean}) {
  const organization = useOrganization();
  const status = getRunDisplayStatus(run.status);
  const outputs = run.executions.flatMap(execution => execution.outputs);
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
        {outputs.length > 0 ? (
          <Stack>
            {outputs.map((output, index) => (
              <Link
                key={`${output.id}-${index}`}
                to={getInvestigationPath(organization.slug, output.id)}
              >
                {`INV-${output.id} | ${output.title}`}
              </Link>
            ))}
          </Stack>
        ) : (
          <Text variant="muted">{'—'}</Text>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {!showStrategy && !run.trigger ? (
          <Text variant="muted">{'—'}</Text>
        ) : (
          <Stack>
            {showStrategy && <Text>{getStrategyLabel(run.strategy)}</Text>}
            {run.trigger?.type === 'monitor' ? (
              <Flex gap="xs" align="center">
                <IconIssues size="xs" />
                <Link
                  to={`/organizations/${organization.slug}/issues/${run.trigger.groupId}/`}
                >
                  {run.trigger.groupShortId ?? `issue:${run.trigger.groupId}`}
                </Link>
              </Flex>
            ) : (
              run.trigger && (
                <Text variant="muted">{fallbackTriggerText(run.trigger.type)}</Text>
              )
            )}
          </Stack>
        )}
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

/**
 * Turns a trigger type like `custom_trigger-type` into `Custom Trigger Type`
 */
function fallbackTriggerText(type: string): string {
  return type
    .split(/[_-]/)
    .filter(Boolean)
    .map(word => upperFirst(word))
    .join(' ');
}
