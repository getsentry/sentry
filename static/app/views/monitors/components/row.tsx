import {Fragment} from 'react';
import styled from '@emotion/styled';

import {deleteMonitor, deleteMonitorEnvironment} from 'sentry/actionCreators/monitors';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Text from 'sentry/components/text';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {scheduleAsText} from 'sentry/views/monitors/utils';

import {Monitor, MonitorEnvironment, MonitorStatus} from '../types';

import {MonitorBadge} from './monitorBadge';

interface MonitorRowProps {
  monitor: Monitor;
  onDelete: (monitorEnv?: string) => void;
  organization: Organization;
  monitorEnv?: MonitorEnvironment;
}

function MonitorRow({monitor, monitorEnv, organization, onDelete}: MonitorRowProps) {
  const api = useApi();
  const lastCheckin = monitorEnv?.lastCheckIn ? (
    <TimeSince unitStyle="regular" date={monitorEnv.lastCheckIn} />
  ) : null;

  const deletionModalMessage = (
    <Fragment>
      <Text>
        {tct('Are you sure you want to permanently delete "[name]"?', {
          name: monitor.name,
        })}
      </Text>
      {monitor.environments.length > 1 && (
        <AdditionalEnvironmentWarning>
          <Text>
            {t(
              `This will delete check-in data for this monitor associated with these environments:`
            )}
          </Text>
          <List symbol="bullet">
            {monitor.environments.map(environment => (
              <ListItem key={environment.name}>{environment.name}</ListItem>
            ))}
          </List>
        </AdditionalEnvironmentWarning>
      )}
    </Fragment>
  );
  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: t('Edit'),
      // TODO(davidenwang): Right now we have to pass the environment
      // through the URL so that when we save the monitor and are
      // redirected back to the details page it queries the backend
      // for a monitor environment with check-in data
      to: normalizeUrl({
        pathname: `/organizations/${organization.slug}/crons/${monitor.slug}/edit/`,
        query: {environment: monitorEnv?.name},
      }),
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      onAction: () => {
        openConfirmModal({
          onConfirm: async () => {
            if (monitorEnv) {
              await deleteMonitorEnvironment(
                api,
                organization.slug,
                monitor.slug,
                monitorEnv.name
              );
            } else {
              await deleteMonitor(api, organization.slug, monitor.slug);
            }
            onDelete(monitorEnv?.name);
          },
          header: t('Delete Monitor?'),
          message: deletionModalMessage,
          confirmText: t('Delete Monitor'),
          priority: 'danger',
        });
      },
    },
  ];

  const monitorDetailUrl = `/organizations/${organization.slug}/crons/${monitor.slug}/${
    monitorEnv ? `?environment=${monitorEnv.name}` : ''
  }`;

  // TODO(davidenwang): Change accordingly when we have ObjectStatus on monitor
  const monitorStatus =
    monitor.status !== 'disabled' && monitorEnv ? monitorEnv.status : monitor.status;

  return (
    <Fragment>
      <MonitorName>
        <MonitorBadge status={monitorStatus} />
        <Link to={monitorDetailUrl}>{monitor.name}</Link>
      </MonitorName>
      <MonitorColumn>
        <TextOverflow>
          {monitorStatus === MonitorStatus.DISABLED
            ? t('Paused')
            : monitorStatus === MonitorStatus.ACTIVE || !lastCheckin
            ? t('Waiting for first check-in')
            : monitorStatus === MonitorStatus.OK
            ? tct('Check-in [lastCheckin]', {lastCheckin})
            : monitorStatus === MonitorStatus.MISSED_CHECKIN
            ? tct('Missed [lastCheckin]', {lastCheckin})
            : monitorStatus === MonitorStatus.ERROR
            ? tct('Failed [lastCheckin]', {lastCheckin})
            : monitorStatus === MonitorStatus.TIMEOUT
            ? t('Timed out')
            : monitorStatus === MonitorStatus.PENDING_DELETION
            ? t('Pending Deletion')
            : monitorStatus === MonitorStatus.DELETION_IN_PROGRESS
            ? t('Deletion In Progress')
            : null}
        </TextOverflow>
      </MonitorColumn>
      <MonitorColumn>{scheduleAsText(monitor.config)}</MonitorColumn>
      <MonitorColumn>
        {monitorEnv?.nextCheckIn &&
        monitorEnv.status !== MonitorStatus.DISABLED &&
        monitorEnv.status !== MonitorStatus.PENDING_DELETION &&
        monitorEnv.status !== MonitorStatus.DELETION_IN_PROGRESS &&
        monitorEnv.status !== MonitorStatus.ACTIVE ? (
          <TimeSince unitStyle="regular" date={monitorEnv.nextCheckIn} />
        ) : (
          '\u2014'
        )}
      </MonitorColumn>
      <MonitorColumn>
        <IdBadge
          project={monitor.project}
          avatarSize={18}
          avatarProps={{hasTooltip: true, tooltip: monitor.project.slug}}
        />
      </MonitorColumn>
      <MonitorColumn>{monitorEnv?.name ?? '\u2014'}</MonitorColumn>
      <ActionsColumn>
        <DropdownMenu
          items={actions}
          position="bottom-end"
          triggerProps={{
            'aria-label': t('Actions'),
            size: 'xs',
            icon: <IconEllipsis size="xs" />,
            showChevron: false,
          }}
        />
      </ActionsColumn>
    </Fragment>
  );
}

export {MonitorRow};

const MonitorName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const MonitorColumn = styled('div')`
  display: flex;
  align-items: center;
`;

const ActionsColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AdditionalEnvironmentWarning = styled('div')`
  margin: ${space(1)} 0;
`;
