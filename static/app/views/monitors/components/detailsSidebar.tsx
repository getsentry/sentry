import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {SectionHeading} from 'sentry/components/charts/styles';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Text from 'sentry/components/text';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCopy} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFormattedDate} from 'sentry/utils/dates';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {
  DEFAULT_CHECKIN_MARGIN,
  DEFAULT_MAX_RUNTIME,
} from 'sentry/views/monitors/components/monitorForm';
import {MonitorIndicator} from 'sentry/views/monitors/components/monitorIndicator';
import type {Monitor, MonitorEnvironment} from 'sentry/views/monitors/types';
import {CheckInStatus, ScheduleType} from 'sentry/views/monitors/types';
import {scheduleAsText} from 'sentry/views/monitors/utils/scheduleAsText';

interface Props {
  monitor: Monitor;
  monitorEnv?: MonitorEnvironment;
  /**
   * Include the UNKNOWN status in the check-in type legend
   */
  showUnknownLegend?: boolean;
}

export default function DetailsSidebar({monitorEnv, monitor, showUnknownLegend}: Props) {
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
        <Text>
          {scheduleAsText(monitor.config)}{' '}
          {schedule_type === ScheduleType.CRONTAB && `(${timezone})`}
        </Text>
        {schedule_type === ScheduleType.CRONTAB && (
          <CrontabText>({schedule})</CrontabText>
        )}
      </Schedule>
      <SectionHeading>{t('Legend')}</SectionHeading>
      <CheckInLegend>
        <CheckInLegendItem>
          <MonitorIndicator status={CheckInStatus.MISSED} size={12} />
          <Text>
            {tn(
              'Check-in missed after %s min',
              'Check-in missed after %s mins',
              checkin_margin ?? DEFAULT_CHECKIN_MARGIN
            )}
          </Text>
        </CheckInLegendItem>
        <CheckInLegendItem>
          <MonitorIndicator status={CheckInStatus.ERROR} size={12} />
          <Text>{t('Check-in reported as failed')}</Text>
        </CheckInLegendItem>
        <CheckInLegendItem>
          <MonitorIndicator status={CheckInStatus.TIMEOUT} size={12} />
          <Text>
            {tn(
              'Check-in timed out after %s min',
              'Check-in timed out after %s mins',
              max_runtime ?? DEFAULT_MAX_RUNTIME
            )}
          </Text>
        </CheckInLegendItem>
        {showUnknownLegend && (
          <CheckInLegendItem>
            <MonitorIndicator status={CheckInStatus.UNKNOWN} size={12} />
            <UnknownText>
              {t('Unknown Status')}
              <QuestionTooltip
                size="sm"
                title={tct(
                  'Sentry was unable to determine the check-in status. [link:Learn More].',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/crons/monitor-details/#check-in-statuses" />
                    ),
                  }
                )}
              />
            </UnknownText>
          </CheckInLegendItem>
        )}
      </CheckInLegend>
      <SectionHeading>{t('Cron Details')}</SectionHeading>
      <KeyValueTable>
        <KeyValueTableRow keyName={t('Monitor Slug')} value={slug} />
        <KeyValueTableRow
          keyName={t('Owner')}
          value={
            monitor.owner ? (
              <ActorAvatar size={24} actor={monitor.owner} />
            ) : (
              t('Unassigned')
            )
          }
        />
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

const CheckInLegend = styled('ul')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(2)};
  padding: 0;
  gap: ${space(1)};
`;

const CheckInLegendItem = styled('li')`
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  grid-column: 1 / -1;
`;

const UnknownText = styled(Text)`
  display: flex;
  gap: ${space(1)};
  align-items: center;
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
