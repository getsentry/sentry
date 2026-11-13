import {IconFire} from '@sentry/icons/fire';
import {IconMail} from '@sentry/icons/mail';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Hovercard} from 'sentry/components/hovercard';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import {GroupStatus} from 'sentry/types/group';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {MetricDetectorDetailsDetect} from 'sentry/views/detectors/components/details/metric/detect';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';

const MAX_VISIBLE_TARGETS = 2;

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 1fr)'},
  {key: 'last-breach', visible: {sm: true}, width: '130px'},
  {key: 'notifies', visible: {md: true}, width: 'minmax(0, 220px)'},
  {key: 'action', width: 'auto'},
];

type AlertTarget = {label: string; type: ActionType};

function useMonitorAlertTargets(monitorIds: string[]) {
  const organization = useOrganization();

  return useQuery({
    ...automationsApiOptions(organization, {
      detector: monitorIds.toSorted(),
      limit: 100,
    }),
    enabled: monitorIds.length > 0,
    select: ({json}) => getAlertTargetsByMonitor(json),
  });
}

function getAlertTargetsByMonitor(alerts: Automation[]) {
  const targetsByMonitor = new Map<string, AlertTarget[]>();
  for (const alert of alerts) {
    if (!alert.enabled) {
      continue;
    }
    const targets = alert.actionFilters.flatMap(filter =>
      (filter.actions ?? []).flatMap(action => {
        const metadata = ActionMetadata[action.type];
        // Actions without metadata, like Seer's own, don't notify anyone
        return metadata
          ? {type: action.type, label: action.config.targetDisplay ?? metadata.name}
          : [];
      })
    );
    for (const monitorId of alert.detectorIds) {
      const known = targetsByMonitor.get(monitorId) ?? [];
      for (const target of targets) {
        if (!known.some(k => k.type === target.type && k.label === target.label)) {
          known.push(target);
        }
      }
      targetsByMonitor.set(monitorId, known);
    }
  }
  return targetsByMonitor;
}

function AlertTargetTag({target}: {target: AlertTarget}) {
  return (
    <Tag
      variant="muted"
      icon={
        target.type === ActionType.EMAIL ? (
          <IconMail />
        ) : (
          <PluginIcon
            pluginId={
              target.type === ActionType.SLACK_STAGING ? ActionType.SLACK : target.type
            }
            size={14}
          />
        )
      }
    >
      {target.label}
    </Tag>
  );
}

function AlertTargets({
  targets,
  isPending,
  isError,
}: {
  isError: boolean;
  isPending: boolean;
  targets: AlertTarget[] | undefined;
}) {
  if (isPending) {
    return <Placeholder height="20px" width="120px" />;
  }
  if (isError) {
    return (
      <Text size="sm" variant="muted">
        {t('Unavailable')}
      </Text>
    );
  }
  if (!targets?.length) {
    return (
      <Text size="sm" variant="muted">
        {t('No alerts')}
      </Text>
    );
  }
  const hidden = targets.slice(MAX_VISIBLE_TARGETS);
  return (
    <Flex gap="xs" wrap="wrap" minWidth={0}>
      {targets.slice(0, MAX_VISIBLE_TARGETS).map(target => (
        <AlertTargetTag key={`${target.type}:${target.label}`} target={target} />
      ))}
      {hidden.length > 0 && (
        <Tooltip title={hidden.map(target => target.label).join(', ')} skipWrapper>
          <Tag variant="muted">{`+${hidden.length}`}</Tag>
        </Tooltip>
      )}
    </Flex>
  );
}

function LastBreach({monitor}: {monitor: MetricDetector}) {
  const organization = useOrganization();
  const group = monitor.latestGroup;

  if (!group) {
    return (
      <Text size="sm" variant="muted">
        {t('No breaches')}
      </Text>
    );
  }

  return (
    <Stack gap="xs" align="start">
      {group.status === GroupStatus.UNRESOLVED && (
        <Tag variant="danger" icon={<IconFire />}>
          {t('Breached')}
        </Tag>
      )}
      <Link to={`/organizations/${organization.slug}/issues/${group.id}/`}>
        <Text size="sm" variant="muted">
          <TimeSince date={group.lastSeen} unitStyle="short" />
        </Text>
      </Link>
    </Stack>
  );
}

type Props = {
  monitors: MetricDetector[];
  renderAction: (monitor: MetricDetector) => React.ReactNode;
  emptyMessage?: string;
  isError?: boolean;
  pendingRows?: number;
};

export function MonitorTable({
  monitors,
  renderAction,
  emptyMessage,
  isError,
  pendingRows = 0,
}: Props) {
  const alertTargets = useMonitorAlertTargets(monitors.map(monitor => monitor.id));

  return (
    <SimpleTable
      columns={COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Monitor')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Last breach')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Notifies')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.HeaderRow>
      }
    >
      {isError && <SimpleTable.Error />}
      {!isError &&
        pendingRows > 0 &&
        Array.from({length: pendingRows}, (_, index) => (
          <SimpleTable.Row key={index}>
            <SimpleTable.RowCell>
              <Stack gap="xs" width="100%">
                <Placeholder height="20px" width="50%" />
                <Placeholder height="16px" width="70%" />
              </Stack>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Placeholder height="20px" />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Placeholder height="20px" />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell />
          </SimpleTable.Row>
        ))}
      {!isError && pendingRows === 0 && monitors.length === 0 && (
        <SimpleTable.Empty>{emptyMessage ?? t('No monitors found')}</SimpleTable.Empty>
      )}
      {!isError &&
        pendingRows === 0 &&
        monitors.map(monitor => (
          <SimpleTable.Row key={monitor.id}>
            <SimpleTable.RowCell>
              <Hovercard
                header={monitor.name}
                body={<MetricDetectorDetailsDetect detector={monitor} />}
                position="right-start"
                containerDisplayMode="block"
                style={{minWidth: 0}}
              >
                <DetectorLink detector={monitor} openInNewTab />
              </Hovercard>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <LastBreach monitor={monitor} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <AlertTargets
                targets={alertTargets.data?.get(monitor.id)}
                isPending={alertTargets.isPending}
                isError={alertTargets.isError}
              />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              {renderAction(monitor)}
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
    </SimpleTable>
  );
}
