import {Fragment} from 'react';
import styled from '@emotion/styled';

import {deleteMonitor} from 'sentry/actionCreators/monitors';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {crontabAsText} from 'sentry/views/monitors/utils';

import {
  Monitor,
  MonitorConfig,
  MonitorEnvironment,
  MonitorStatus,
  ScheduleType,
} from '../types';

import {MonitorBadge} from './monitorBadge';

interface MonitorRowProps {
  monitor: Monitor;
  onDelete: () => void;
  organization: Organization;
  monitorEnv?: MonitorEnvironment;
}

function scheduleAsText(config: MonitorConfig) {
  // Crontab format uses cronstrue
  if (config.schedule_type === ScheduleType.CRONTAB) {
    const parsedSchedule = crontabAsText(config.schedule);
    return parsedSchedule ?? t('Unknown schedule');
  }

  // Interval format is simpler
  const [value, timeUnit] = config.schedule;

  if (timeUnit === 'minute') {
    return tn('Every minute', 'Every %s minutes', value);
  }

  if (timeUnit === 'hour') {
    return tn('Every hour', 'Every %s hours', value);
  }

  if (timeUnit === 'day') {
    return tn('Every day', 'Every %s days', value);
  }

  if (timeUnit === 'week') {
    return tn('Every week', 'Every %s weeks', value);
  }

  if (timeUnit === 'month') {
    return tn('Every month', 'Every %s months', value);
  }

  return t('Unknown schedule');
}

function MonitorRow({monitor, monitorEnv, organization, onDelete}: MonitorRowProps) {
  const api = useApi();
  const lastCheckin = monitorEnv?.lastCheckIn ? (
    <TimeSince unitStyle="regular" date={monitorEnv.lastCheckIn} />
  ) : null;

  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: t('Edit'),
      to: normalizeUrl(`/organizations/${organization.slug}/crons/${monitor.slug}/edit/`),
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      onAction: () => {
        openConfirmModal({
          onConfirm: async () => {
            await deleteMonitor(api, organization.slug, monitor.slug);
            onDelete();
          },
          header: t('Delete Monitor?'),
          message: tct('Are you sure you want to permanently delete [name]?', {
            name: monitor.name,
          }),
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
  const monitorStatus = monitorEnv ? monitorEnv.status : monitor.status;

  return (
    <Fragment>
      <MonitorName>
        <MonitorBadge status={monitorEnv?.status ?? monitor.status} />
        <NameAndSlug>
          <Link to={monitorDetailUrl}>{monitor.name}</Link>
          <MonitorSlug>{monitor.slug}</MonitorSlug>
        </NameAndSlug>
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
            : null}
        </TextOverflow>
      </MonitorColumn>
      <MonitorColumn>{scheduleAsText(monitor.config)}</MonitorColumn>
      <MonitorColumn>
        {monitorEnv?.nextCheckIn &&
        monitorEnv.status !== MonitorStatus.DISABLED &&
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

const NameAndSlug = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
`;

const MonitorSlug = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
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
