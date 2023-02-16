import {Fragment} from 'react';
import styled from '@emotion/styled';
import cronstrue from 'cronstrue';

import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {shouldUse24Hours} from 'sentry/utils/dates';

import {MonitorBadge} from './monitorBadge';
import {Monitor, MonitorConfig, MonitorStatus, ScheduleType} from './types';

interface MonitorRowProps {
  monitor: Monitor;
  organization: Organization;
}

function scheduleAsText(config: MonitorConfig) {
  // Crontab format uses cronstrue
  if (config.schedule_type === ScheduleType.CRONTAB) {
    return cronstrue.toString(config.schedule, {
      verbose: true,
      throwExceptionOnParseError: false,
      use24HourTimeFormat: shouldUse24Hours(),
    });
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

function MonitorRow({monitor, organization}: MonitorRowProps) {
  const lastCheckin = <TimeSince unitStyle="regular" date={monitor.lastCheckIn} />;

  return (
    <Fragment>
      <MonitorName>
        <MonitorBadge status={monitor.status} />
        <Link to={`/organizations/${organization.slug}/crons/${monitor.id}/`}>
          {monitor.name}
        </Link>
      </MonitorName>
      <StatusColumn>
        <TextOverflow>
          {monitor.status === MonitorStatus.DISABLED
            ? t('Paused')
            : monitor.status === MonitorStatus.ACTIVE
            ? t('Waiting for first check-in')
            : monitor.status === MonitorStatus.OK
            ? tct('Check-in [lastCheckin]', {lastCheckin})
            : monitor.status === MonitorStatus.MISSED_CHECKIN
            ? tct('Missed [lastCheckin]', {lastCheckin})
            : monitor.status === MonitorStatus.ERROR
            ? tct('Failed [lastCheckin]', {lastCheckin})
            : null}
        </TextOverflow>
      </StatusColumn>
      <ScheduleColumn>
        <TextOverflow>{scheduleAsText(monitor.config)}</TextOverflow>
      </ScheduleColumn>
      <NextCheckin>
        {monitor.nextCheckIn &&
        monitor.status !== MonitorStatus.DISABLED &&
        monitor.status !== MonitorStatus.ACTIVE ? (
          <TimeSince unitStyle="regular" date={monitor.nextCheckIn} />
        ) : (
          '\u2014'
        )}
      </NextCheckin>
      <ProjectColumn>
        <IdBadge
          project={monitor.project}
          avatarSize={18}
          avatarProps={{hasTooltip: true, tooltip: monitor.project.slug}}
        />
      </ProjectColumn>
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

const StatusColumn = styled('div')`
  display: flex;
  align-items: center;
`;

const ScheduleColumn = styled('div')`
  display: flex;
  align-items: center;
`;

const NextCheckin = styled('div')`
  display: flex;
  align-items: center;
`;

const ProjectColumn = styled('div')`
  display: flex;
  align-items: center;
`;
