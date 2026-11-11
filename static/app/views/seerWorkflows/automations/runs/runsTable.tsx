import {Fragment} from 'react';
import {IconClock} from '@sentry/icons/clock';
import {IconFire} from '@sentry/icons/fire';
import {IconIssues} from '@sentry/icons/issues';
import {useQuery} from '@tanstack/react-query';
import upperFirst from 'lodash/upperFirst';
import {useQueryState} from 'nuqs';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {getInvestigationPath} from 'sentry/views/investigations/utils';
import {useFetchConfigs} from 'sentry/views/seerWorkflows/automations/hooks/configs';
import {useAutomationRuns} from 'sentry/views/seerWorkflows/automations/hooks/useAutomationRuns';
import {getStrategyLabel} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerAutomationRun,
  SeerWorkflowConfigResponse,
  WorkflowDisplayStatus,
} from 'sentry/views/seerWorkflows/types';
import {getAutomationDetailPath} from 'sentry/views/seerWorkflows/utils';

import {getRunDisplayStatus, getStatusLabel, StatusIcon} from './statusIcon';

type RunOutput = SeerAutomationRun['executions'][number]['outputs'][number];

type MonitorTrigger = Extract<
  NonNullable<SeerAutomationRun['trigger']>,
  {type: 'monitor'}
>;

function getColumns(showAutomation: boolean): TableColumnConfig[] {
  return [
    {key: 'status', width: 'max-content'},
    {key: 'output', width: 'minmax(0, 2fr)'},
    ...(showAutomation
      ? [{key: 'automation', visible: {md: true}, width: 'minmax(0, 1.25fr)'}]
      : []),
    {key: 'trigger', width: 'minmax(0, 1.75fr)'},
    {key: 'started', width: 'max-content'},
  ];
}

/**
 * Pass `configId` to only show one automation's runs. Pass `showStrategy={false}` to
 * leave the automation column out, e.g. when the page is already scoped to one
 * automation.
 */
export function RunsTable({
  configId,
  showStrategy = true,
}: {
  configId?: string;
  showStrategy?: boolean;
}) {
  const organization = useOrganization();
  const [cursor] = useQueryState('cursor');
  const {runs, pageLinks, isPending, isLoadingError, refetch} = useAutomationRuns({
    configId,
    cursor: cursor || undefined,
  });

  const configIds = [...new Set(runs.map(run => run.configId))].sort();
  const configs = useFetchConfigs({ids: showStrategy ? configIds : []});
  const configsById = new Map(configs.data?.map(config => [config.id, config]));

  const monitorIds = [
    ...new Set(
      runs.flatMap(run => (run.trigger?.type === 'monitor' ? run.trigger.detectorId : []))
    ),
  ].sort();
  const monitors = useQuery({
    ...detectorListApiOptions(organization, {ids: monitorIds, limit: 100}),
    enabled: monitorIds.length > 0,
    select: ({json}) => new Map(json.map(monitor => [monitor.id, monitor])),
  });

  if (isLoadingError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <Fragment>
      <SimpleTable
        columns={getColumns(showStrategy)}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Result')}</SimpleTable.HeaderCell>
            {showStrategy && (
              <SimpleTable.HeaderCell>{t('Automation')}</SimpleTable.HeaderCell>
            )}
            <SimpleTable.HeaderCell>{t('Triggered by')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Started')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending ? (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        ) : runs.length === 0 ? (
          <SimpleTable.Empty>
            <Stack gap="xs" align="center">
              <Text bold>{t('No runs yet')}</Text>
              <Text variant="muted">
                {t(
                  'A run starts whenever a connected monitor is breached or a scheduled automation fires.'
                )}
              </Text>
            </Stack>
          </SimpleTable.Empty>
        ) : (
          runs.map(run => (
            <RunRow
              key={run.id}
              run={run}
              showAutomation={showStrategy}
              isConfigPending={configs.isPending}
              isMonitorPending={monitors.isPending}
              config={configsById.get(run.configId)}
              monitor={
                run.trigger?.type === 'monitor'
                  ? monitors.data?.get(run.trigger.detectorId)
                  : undefined
              }
            />
          ))
        )}
      </SimpleTable>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

function getDisplayStatus(run: SeerAutomationRun): WorkflowDisplayStatus | null {
  const status = getRunDisplayStatus(run.status);
  if (
    status === 'failed' &&
    run.executions.some(execution => execution.status === 'complete')
  ) {
    return 'partial';
  }
  return status;
}

function getErrorMessage(run: SeerAutomationRun): string | null {
  if (run.status !== 'failed' && run.status !== 'rejected') {
    return null;
  }
  if (run.error) {
    return run.error.message;
  }
  for (const execution of run.executions) {
    if (execution.status === 'failed') {
      return execution.error.message;
    }
  }
  return null;
}

function RunRow({
  run,
  showAutomation,
  isConfigPending,
  isMonitorPending,
  config,
  monitor,
}: {
  isConfigPending: boolean;
  isMonitorPending: boolean;
  run: SeerAutomationRun;
  showAutomation: boolean;
  config?: SeerWorkflowConfigResponse;
  monitor?: Detector;
}) {
  const organization = useOrganization();
  const status = getDisplayStatus(run);
  const outputs = run.executions.flatMap(execution => execution.outputs);
  const errorMessage = getErrorMessage(run);
  const automationName = config?.name ?? getStrategyLabel(run.strategy);

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Stack gap="xs">
          <Flex gap="sm" align="center">
            {status ? (
              <Fragment>
                <StatusIcon status={status} />
                <Text
                  variant={
                    status === 'running' || status === 'skipped' ? 'muted' : undefined
                  }
                >
                  {getStatusLabel(status)}
                </Text>
              </Fragment>
            ) : (
              <Text variant="muted">{'—'}</Text>
            )}
          </Flex>
          <Text variant="muted">{`#${run.id}`}</Text>
        </Stack>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Stack gap="xs" minWidth="0">
          <RunOutputs outputs={outputs} />
          {errorMessage ? (
            <Text variant={run.status === 'failed' ? 'danger' : 'muted'}>
              {errorMessage}
            </Text>
          ) : outputs.length === 0 ? (
            <Text variant="muted">
              {status === 'running' ? t('Investigating…') : t('No output')}
            </Text>
          ) : null}
        </Stack>
      </SimpleTable.RowCell>
      {showAutomation && (
        <SimpleTable.RowCell>
          {isConfigPending ? (
            <Placeholder height="20px" width="120px" />
          ) : (
            <InfoText title={automationName} mode="overflowOnly">
              <Link to={getAutomationDetailPath(organization.slug, run.configId)}>
                {automationName}
              </Link>
            </InfoText>
          )}
        </SimpleTable.RowCell>
      )}
      <SimpleTable.RowCell>
        {run.trigger?.type === 'monitor' ? (
          <MonitorTriggerCell
            trigger={run.trigger}
            monitor={monitor}
            isMonitorPending={isMonitorPending}
          />
        ) : run.trigger?.type === 'cron' ? (
          <Flex gap="xs" align="center">
            <IconClock size="xs" variant="muted" />
            <Text>{t('Schedule')}</Text>
          </Flex>
        ) : run.trigger ? (
          <Text variant="muted">{fallbackTriggerText(run.trigger)}</Text>
        ) : (
          <Text variant="muted">{'—'}</Text>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <RunTiming run={run} />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function OutputLink({output}: {output: RunOutput}) {
  const organization = useOrganization();
  if (output.type !== 'investigation') {
    return <Text>{fallbackOutputText(output)}</Text>;
  }
  return (
    <Text>
      <Text bold>
        <Link to={getInvestigationPath(organization.slug, output.id)}>
          {output.title}
        </Link>
      </Text>{' '}
      <Text variant="muted" wrap="nowrap">
        {`INV-${output.id}`}
      </Text>
    </Text>
  );
}

function RunOutputs({outputs}: {outputs: RunOutput[]}) {
  const [first] = outputs;
  if (!first) {
    return null;
  }
  if (outputs.length === 1) {
    return <OutputLink output={first} />;
  }
  return (
    <Flex>
      <Hovercard
        position="bottom-start"
        showUnderline
        body={
          <Stack gap="md">
            {outputs.map((output, index) => (
              <OutputLink key={`${output.id}-${index}`} output={output} />
            ))}
          </Stack>
        }
      >
        <Text bold>{tn('%s investigation', '%s investigations', outputs.length)}</Text>
      </Hovercard>
    </Flex>
  );
}

function MonitorTriggerCell({
  trigger,
  monitor,
  isMonitorPending,
}: {
  isMonitorPending: boolean;
  trigger: MonitorTrigger;
  monitor?: Detector;
}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: trigger.projectId});

  return (
    <Stack gap="xs" minWidth="0">
      <Flex gap="xs" align="center" minWidth="0">
        <IconFire size="xs" variant="muted" />
        {isMonitorPending ? (
          <Placeholder height="20px" width="160px" />
        ) : (
          <InfoText title={monitor?.name} mode="overflowOnly">
            {monitor ? (
              <Link to={makeMonitorDetailsPathname(organization.slug, monitor.id)}>
                {monitor.name}
              </Link>
            ) : (
              t('Metric monitor breach')
            )}
          </InfoText>
        )}
      </Flex>
      <Flex gap="sm" align="center" wrap="wrap">
        {project && (
          <ProjectBadge project={project} avatarSize={14} hideName disableLink />
        )}
        <Flex gap="xs" align="center">
          <IconIssues size="xs" variant="muted" />
          <Text>
            <Link to={`/organizations/${organization.slug}/issues/${trigger.groupId}/`}>
              {trigger.groupShortId ?? `issue:${trigger.groupId}`}
            </Link>
          </Text>
        </Flex>
        {trigger.environment && <Tag variant="muted">{trigger.environment}</Tag>}
      </Flex>
    </Stack>
  );
}

function RunTiming({run}: {run: SeerAutomationRun}) {
  const inProgress = run.status === 'queued' || run.status === 'running';
  const duration = run.dateCompleted
    ? getDuration(
        (new Date(run.dateCompleted).getTime() - new Date(run.dateAdded).getTime()) /
          1000,
        0,
        true
      )
    : null;

  return (
    <Stack gap="xs">
      <Text wrap="nowrap">
        <TimeSince
          date={run.dateAdded}
          maxWidth={320}
          tooltipBody={
            <Grid
              columns="max-content max-content"
              gap="xs md"
              align="center"
              justifyItems="start"
            >
              <Text variant="muted">{t('Started')}</Text>
              <DateTime date={run.dateAdded} seconds timeZone />
              {run.dateCompleted && (
                <Fragment>
                  <Text variant="muted">{t('Finished')}</Text>
                  <DateTime date={run.dateCompleted} seconds timeZone />
                  <Text variant="muted">{t('Duration')}</Text>
                  <Text>{duration}</Text>
                </Fragment>
              )}
            </Grid>
          }
        />
      </Text>
      {inProgress ? (
        <Text variant="muted" wrap="nowrap">
          {tct('running for [duration]', {
            duration: (
              <TimeSince
                date={run.dateAdded}
                suffix=""
                liveUpdateInterval="second"
                disabledAbsoluteTooltip
              />
            ),
          })}
        </Text>
      ) : (
        duration && (
          <Text variant="muted" wrap="nowrap">
            {t('took %s', duration)}
          </Text>
        )
      )}
    </Stack>
  );
}

/**
 * Turns a trigger type like `custom_trigger-type` into `Custom Trigger Type`
 */
function fallbackTriggerText(trigger: {type: string}): string {
  return trigger.type
    .split(/[_-]/)
    .filter(Boolean)
    .map(word => upperFirst(word))
    .join(' ');
}

/**
 * Plain text for output types without their own display, e.g. `report:12`
 */
function fallbackOutputText(output: {id: string; type: string}): string {
  return `${output.type}:${output.id}`;
}
