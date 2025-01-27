import {useRef} from 'react';
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

export function UptimeDataSection({group, event, project}: Props) {
  const organization = useOrganization();
  const nowRef = useRef(new Date());
  const downtimeStartActivity = group.activity.find(activity =>
    DOWNTIME_START_TYPES.includes(activity.type)
  );
  const downtimeEndActivity = group.activity.find(activity =>
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
            duration,
          })
        : tct('Domain has been down for [duration]', {
            duration,
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
