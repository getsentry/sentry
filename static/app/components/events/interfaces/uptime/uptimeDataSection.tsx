import {useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {type Group, GroupActivityType, GroupStatus} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface Props {
  event: Event;
  group: Group;
  project: Project;
}

const DOWNTIME_START_TYPES = [
  GroupActivityType.SET_UNRESOLVED,
  GroupActivityType.FIRST_SEEN,
  GroupActivityType.SET_REGRESSION,
];

const DOWNTIME_TERMINAL_TYPES = [GroupActivityType.SET_RESOLVED];

export function useDowntimeDuration({group}: {group: Group}): {
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

export function UptimeDataSection({group, event, project}: Props) {
  const organization = useOrganization();
  const isResolved = group.status === GroupStatus.RESOLVED;
  const alertRuleId = event.tags.find(tag => tag.key === 'uptime_rule')?.value;

  return (
    <InterimSection
      title={t('Downtime Information')}
      type={SectionKey.DOWNTIME}
      help={t('Information about the detected downtime')}
      preventCollapse
      actions={
        alertRuleId !== undefined && (
          <LinkButton
            icon={<IconSettings />}
            size="xs"
            to={normalizeUrl(
              `/organizations/${organization.slug}/alerts/rules/uptime/${project.slug}/${alertRuleId}/details/`
            )}
          >
            {t('Uptime Alert Rule')}
          </LinkButton>
        )
      }
    >
      {isResolved
        ? tct('Domain was down for [duration]', {
            duration: <DowntimeDuration group={group} />,
          })
        : tct('Domain has been down for [duration]', {
            duration: <DowntimeDuration group={group} />,
          })}
    </InterimSection>
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
