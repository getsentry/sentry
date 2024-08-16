import {useRef} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type Group, GroupActivityType, GroupStatus} from 'sentry/types/group';

interface Props {
  group: Group;
}

const DOWNTIME_START_TYPES = [
  GroupActivityType.SET_UNRESOLVED,
  GroupActivityType.FIRST_SEEN,
];

const DOWNTIME_TERMINAL_TYPES = [GroupActivityType.SET_RESOLVED];

export function UptimeDataSection({group}: Props) {
  const nowRef = useRef(new Date());
  const downtimeStartActivity = group.activity.findLast(activity =>
    DOWNTIME_START_TYPES.includes(activity.type)
  );
  const downtimeEndActivity = group.activity.findLast(activity =>
    DOWNTIME_TERMINAL_TYPES.includes(activity.type)
  );

  const isResolved = group.status === GroupStatus.RESOLVED;
  const startDate = new Date(downtimeStartActivity?.dateCreated ?? group.firstSeen);
  const endDate = isResolved
    ? new Date(downtimeEndActivity?.dateCreated ?? group.lastSeen)
    : nowRef.current;

  const durationMs = endDate.getTime() - startDate.getTime();

  const duration = (
    <Tooltip
      title={
        <DowntimeTooltipTitle>
          <DowntimeLabel>{t('From:')}</DowntimeLabel>
          <DateTime date={startDate} timeZone />
          <DowntimeLabel>{t('To:')}</DowntimeLabel>
          {isResolved ? <DateTime date={endDate} timeZone /> : t('Now')}
        </DowntimeTooltipTitle>
      }
      showUnderline
    >
      <Duration seconds={durationMs / 1000} />
    </Tooltip>
  );

  return (
    <EventDataSection
      title={t('Downtime Information')}
      type="downtime"
      help={t('Information about the detected downtime')}
    >
      {isResolved
        ? tct('Domain was down for [duration]', {
            duration,
          })
        : tct('Domain has been down for [duration]', {
            duration,
          })}
    </EventDataSection>
  );
}

const DowntimeTooltipTitle = styled('div')`
  display: grid;
  column-gap: ${space(1)};
  grid-template-columns: max-content 1fr;
  justify-items: start;
`;

const DowntimeLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
`;
