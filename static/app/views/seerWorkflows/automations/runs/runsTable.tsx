import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconClock} from '@sentry/icons/clock';
import {IconIssues} from '@sentry/icons/issues';
import {IconSiren} from '@sentry/icons/siren';
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
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {getPaginationProps} from 'sentry/utils/pagination';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {getInvestigationPath} from 'sentry/views/investigations/utils';
import {useAutomationRuns} from 'sentry/views/seerWorkflows/automations/hooks/useAutomationRuns';
import {getStrategyLabel} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerAutomationRun,
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
          runs.map(run => <RunRow key={run.id} run={run} showAutomation={showStrategy} />)
        )}
      </SimpleTable>
      <Pagination {...getPaginationProps(pageLinks)} />
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
}: {
  run: SeerAutomationRun;
  showAutomation: boolean;
}) {
  const organization = useOrganization();
  const status = getDisplayStatus(run);
  const outputs = run.executions.flatMap(execution => execution.outputs);
  const errorMessage = getErrorMessage(run);
  const automationName = run.configName ?? getStrategyLabel(run.strategy);

  return (
    <RunTableRow>
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
          <InfoText title={automationName} mode="overflowOnly">
            <UnderlineLink to={getAutomationDetailPath(organization.slug, run.configId)}>
              {automationName}
            </UnderlineLink>
          </InfoText>
        </SimpleTable.RowCell>
      )}
      <SimpleTable.RowCell>
        {run.trigger?.type === 'monitor' ? (
          <MonitorTriggerCell trigger={run.trigger} />
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
    </RunTableRow>
  );
}

const RunTableRow = styled(SimpleTable.Row)`
  > [role='cell']:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const UnderlineLink = styled(Link)`
  &:hover {
    text-decoration: underline;
  }
`;

function OutputLink({output}: {output: RunOutput}) {
  const organization = useOrganization();
  if (output.type !== 'investigation') {
    return <Text>{fallbackOutputText(output)}</Text>;
  }
  return (
    <Text>
      <Text bold>
        <UnderlineLink to={getInvestigationPath(organization.slug, output.id)}>
          {output.title}
        </UnderlineLink>
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

function MonitorTriggerCell({trigger}: {trigger: MonitorTrigger}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: trigger.projectId});
  const monitorLabel = trigger.detectorName ?? t('Monitor %s', trigger.detectorId);
  const issueLabel = trigger.groupShortId ?? `issue:${trigger.groupId}`;

  return (
    <Stack gap="xs" minWidth="0">
      <Flex gap="xs" align="center" minWidth="0">
        <IconSiren size="xs" variant="muted" />
        <InfoText title={monitorLabel} mode="overflowOnly">
          {trigger.detectorName ? (
            <UnderlineLink
              to={makeMonitorDetailsPathname(organization.slug, trigger.detectorId)}
            >
              {monitorLabel}
            </UnderlineLink>
          ) : (
            <Text cursor="not-allowed">{monitorLabel}</Text>
          )}
        </InfoText>
      </Flex>
      <Flex gap="sm" align="center" wrap="wrap">
        {project && (
          <ProjectBadge project={project} avatarSize={14} hideName disableLink />
        )}
        <Flex gap="xs" align="center">
          <IconIssues size="xs" variant="muted" />
          <Text>
            {trigger.groupExists ? (
              <UnderlineLink
                to={`/organizations/${organization.slug}/issues/${trigger.groupId}/`}
              >
                {issueLabel}
              </UnderlineLink>
            ) : (
              <Text cursor="not-allowed">{issueLabel}</Text>
            )}
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
