import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Text from 'sentry/components/text';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCopy} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {DEFAULT_MAX_RUNTIME} from 'sentry/views/monitors/components/monitorForm';
import MonitorIcon from 'sentry/views/monitors/components/monitorIcon';
import {
  Monitor,
  MonitorEnvironment,
  MonitorStatus,
  ScheduleType,
} from 'sentry/views/monitors/types';
import {scheduleAsText} from 'sentry/views/monitors/utils';

interface Props {
  monitor: Monitor;
  monitorEnv?: MonitorEnvironment;
}

export default function DetailsSidebar({monitorEnv, monitor}: Props) {
  const {checkin_margin, schedule, schedule_type, max_runtime, timezone} = monitor.config;
  const {onClick, label} = useCopyToClipboard({text: monitor.slug});

  const slug = (
    <Tooltip title={label}>
      <MonitorSlug onClick={onClick}>
        <SlugText>{monitor.slug}</SlugText>
        <IconCopy size="xs" />
      </MonitorSlug>
    </Tooltip>
  );

  return (
    <Fragment>
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
          {monitor.status !== 'disabled' && monitorEnv?.nextCheckIn ? (
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
        <Text>{scheduleAsText(monitor.config)}</Text>
        {schedule_type === ScheduleType.CRONTAB && (
          <CrontabText>({schedule})</CrontabText>
        )}
      </Schedule>
      <SectionHeading>{t('Margins')}</SectionHeading>
      <Thresholds>
        <MonitorIcon status={MonitorStatus.MISSED_CHECKIN} size={12} />
        <Text>
          {defined(checkin_margin)
            ? tn(
                'Check-ins missed after %s min',
                'Check-ins missed after %s mins',
                checkin_margin
              )
            : t('Check-ins that are missed')}
        </Text>
        <MonitorIcon status={MonitorStatus.ERROR} size={12} />
        <Text>
          {tn(
            'Check-ins longer than %s min or errors',
            'Check-ins longer than %s mins or errors',
            max_runtime ?? DEFAULT_MAX_RUNTIME
          )}
        </Text>
      </Thresholds>
      <SectionHeading>{t('Cron Details')}</SectionHeading>
      <KeyValueTable>
        <KeyValueTableRow keyName={t('Monitor Slug')} value={slug} />
        {schedule_type === ScheduleType.CRONTAB && (
          <KeyValueTableRow keyName={t('Timezone')} value={timezone} />
        )}
        <KeyValueTableRow
          keyName={t('Date created')}
          value={getFormattedDate(monitor.dateCreated, 'MMM D, YYYY')}
        />
      </KeyValueTable>
    </Fragment>
  );
}

const CheckIns = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: ${space(2)};
`;

const Schedule = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const CrontabText = styled(Text)`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.subText};
`;

const Thresholds = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(2)};
  align-items: center;
  gap: ${space(1)};
`;

const MonitorSlug = styled('button')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: ${space(0.5)};

  background: transparent;
  border: none;
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const SlugText = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
