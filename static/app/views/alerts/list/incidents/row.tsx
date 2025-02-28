import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import Duration from 'sentry/components/duration';
import ErrorBoundary from 'sentry/components/errorBoundary';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {Incident} from 'sentry/views/alerts/types';
import {IncidentStatus} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';

type Props = {
  incident: Incident;
  organization: Organization;
  projects: Project[];
  projectsLoaded: boolean;
};

function AlertListRow({incident, projectsLoaded, projects, organization}: Props) {
  const slug = incident.projects[0]!;
  const started = moment(incident.dateStarted);
  const duration = moment
    .duration(moment(incident.dateClosed || new Date()).diff(started))
    .as('seconds');

  const project = useMemo(() => projects.find(p => p.slug === slug), [slug, projects]);

  const alertLink = {
    pathname: alertDetailsLink(organization, incident),
    query: {alert: incident.identifier},
  };
  const ownerId = incident.alertRule.owner?.split(':')[1];
  let teamName = '';
  if (ownerId) {
    teamName = TeamStore.getById(ownerId)?.name ?? '';
  }
  const teamActor = ownerId
    ? {type: 'team' as Actor['type'], id: ownerId, name: teamName}
    : null;

  return (
    <ErrorBoundary>
      <FlexCenter>
        <Title data-test-id="alert-title">
          <Link to={alertLink}>{incident.title}</Link>
        </Title>
      </FlexCenter>

      <NoWrapNumeric>
        {getDynamicText({
          value: <TimeSince date={incident.dateStarted} unitStyle="extraShort" />,
          fixed: '1w ago',
        })}
      </NoWrapNumeric>
      <NoWrapNumeric>
        {incident.status === IncidentStatus.CLOSED ? (
          <Duration seconds={getDynamicText({value: duration, fixed: 1200})} />
        ) : (
          <Tag type="warning">{t('Still Active')}</Tag>
        )}
      </NoWrapNumeric>

      <FlexCenter>
        <ProjectBadge avatarSize={18} project={!projectsLoaded ? {slug} : project} />
      </FlexCenter>
      <NoWrapNumeric>#{incident.id}</NoWrapNumeric>

      <FlexCenter>
        {teamActor ? (
          <Fragment>
            <StyledActorAvatar actor={teamActor} size={18} hasTooltip={false} />{' '}
            <TeamWrapper>{teamActor.name}</TeamWrapper>
          </Fragment>
        ) : (
          '-'
        )}
      </FlexCenter>
    </ErrorBoundary>
  );
}

const Title = styled('div')`
  ${p => p.theme.overflowEllipsis}
  min-width: 130px;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const FlexCenter = styled('div')`
  ${p => p.theme.overflowEllipsis}
  display: flex;
  align-items: center;
  line-height: 1.6;
`;

const NoWrapNumeric = styled(FlexCenter)`
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

const TeamWrapper = styled('span')`
  ${p => p.theme.overflowEllipsis}
`;

const StyledActorAvatar = styled(ActorAvatar)`
  margin-right: ${space(1)};
`;

export default AlertListRow;
