import {useState} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {t} from 'sentry/locale';
import {GroupActivityType, GroupStatus, type Group} from 'sentry/types/group';

const DOWNTIME_START_TYPES = [
  GroupActivityType.SET_UNRESOLVED,
  GroupActivityType.FIRST_SEEN,
  GroupActivityType.SET_REGRESSION,
];

const DOWNTIME_TERMINAL_TYPES = [GroupActivityType.SET_RESOLVED];

function useDowntimeDuration({group}: {group: Group}): {
  durationMs: number;
  endDate: Date;
  startDate: Date;
} {
  const [now] = useState(() => new Date());
  const downtimeStartActivity = group.activity.find(activity =>
    DOWNTIME_START_TYPES.includes(activity.type)
  );
  const downtimeEndActivity = group.activity.find(activity =>
    DOWNTIME_TERMINAL_TYPES.includes(activity.type)
  );
  const startDate = new Date(downtimeStartActivity?.dateCreated ?? group.firstSeen);
  const endDate =
    group.status === GroupStatus.RESOLVED
      ? new Date(downtimeEndActivity?.dateCreated ?? group.lastSeen)
      : now;

  const durationMs = endDate.getTime() - startDate.getTime();
  return {durationMs, startDate, endDate};
}

export function DowntimeDuration({group}: {group: Group}) {
  const {durationMs, startDate, endDate} = useDowntimeDuration({group});
  return (
    <Tooltip
      title={
        <DowntimeTooltipTitle>
          <DowntimeLabel>{t('From:')}</DowntimeLabel>
          <DateTime date={startDate} timeZone />
          <DowntimeLabel>{t('To:')}</DowntimeLabel>
          {group.status === GroupStatus.RESOLVED ? (
            <DateTime date={endDate} timeZone />
          ) : (
            t('Now')
          )}
        </DowntimeTooltipTitle>
      }
      showUnderline
    >
      <Duration seconds={durationMs / 1000} />
    </Tooltip>
  );
}

const DowntimeTooltipTitle = styled('div')`
  display: grid;
  column-gap: ${p => p.theme.space.md};
  grid-template-columns: max-content 1fr;
  justify-items: start;
`;

const DowntimeLabel = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
