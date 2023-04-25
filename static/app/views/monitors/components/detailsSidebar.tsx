import React from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import Clipboard from 'sentry/components/clipboard';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Text from 'sentry/components/text';
import TimeSince from 'sentry/components/timeSince';
import {IconCopy} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import {DEFAULT_MAX_RUNTIME} from 'sentry/views/monitors/components/monitorForm';
import MonitorIcon from 'sentry/views/monitors/components/monitorIcon';
import {
  IntervalConfig,
  Monitor,
  MonitorEnvironment,
  MonitorStatus,
  ScheduleType,
} from 'sentry/views/monitors/types';

interface Props {
  monitor: Monitor;
  monitorEnv?: MonitorEnvironment;
}

function getIntervalScheduleText(schedule: IntervalConfig['schedule']) {
  const [n, period] = schedule;
  const intervalTextMap = {
    minute: tn('Every %s minute', 'Every %s minutes', n),
    hour: tn('Every %s hour', 'Every %s hours', n),
    day: tn('Every %s day', 'Every %s days', n),
    week: tn('Every %s week', 'Every %s weeks', n),
    month: tn('Every %s month', 'Every %s months', n),
    year: tn('Every %s year', 'Every %s years', n),
  };
  return intervalTextMap[period];
}

export default function DetailsSidebar({monitorEnv, monitor}: Props) {
  const {checkin_margin, schedule, schedule_type, max_runtime, timezone} = monitor.config;

  const slug = (
    <Clipboard value={monitor.slug}>
      <MonitorSlug>
        <SlugText>{monitor.slug}</SlugText>
        <IconCopy size="xs" />
      </MonitorSlug>
    </Clipboard>
  );

  return (
    <React.Fragment>
      <CheckIns>
        <SectionHeading>{t('Last Check-In')}</SectionHeading>
        <SectionHeading>{t('Next Check-In')}</SectionHeading>
        <div>
          {monitorEnv?.lastCheckIn ? (
            <TimeSince
              unitStyle="regular"
              liveUpdateInterval="second"
              date={monitorEnv.lastCheckIn}
            />
          ) : (
            '-'
          )}
        </div>
        <div>
          {monitorEnv?.nextCheckIn ? (
            <TimeSince
              unitStyle="regular"
              liveUpdateInterval="second"
              date={monitorEnv.nextCheckIn}
            />
          ) : (
            '-'
          )}
        </div>
      </CheckIns>
      <SectionHeading>{t('Schedule')}</SectionHeading>
      <Schedule>
        <MonitorIcon status={MonitorStatus.OK} size={12} />
        <Text>
          {schedule_type === ScheduleType.CRONTAB
            ? schedule
            : getIntervalScheduleText(schedule as IntervalConfig['schedule'])}
        </Text>
        <MonitorIcon status={MonitorStatus.MISSED_CHECKIN} size={12} />
        <Text>
          {defined(checkin_margin)
            ? tn('Check-ins %s min late', 'Check-ins %s mins late', checkin_margin)
            : t('Check-ins that are late')}
        </Text>
        <MonitorIcon status={MonitorStatus.ERROR} size={12} />
        <Text>
          {tn(
            'Check-ins longer than %s min or errors',
            'Check-ins longer than %s mins or errors',
            max_runtime ?? DEFAULT_MAX_RUNTIME
          )}
        </Text>
      </Schedule>
      <SectionHeading>{t('Cron Details')}</SectionHeading>
      <KeyValueTable>
        <CronTableRow keyName={t('Monitor Slug')} value={slug} />
        {schedule_type === ScheduleType.CRONTAB && (
          <KeyValueTableRow keyName={t('Timezone')} value={timezone} />
        )}
        <KeyValueTableRow
          keyName={t('Date created')}
          value={getFormattedDate(monitor.dateCreated, 'MMM D, YYYY')}
        />
      </KeyValueTable>
    </React.Fragment>
  );
}

const CheckIns = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: ${space(2)};
`;

const Schedule = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(2)};
  align-items: center;
  gap: ${space(1)};
`;

const MonitorSlug = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: ${space(0.5)};
  cursor: pointer;
`;

const SlugText = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CronTableRow = styled(KeyValueTableRow)`
  dd: {
    overflow: hidden;
    white-space: nowrap;
  }
`;
