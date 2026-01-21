import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';
import Duration from 'sentry/components/duration';
import ErrorBoundary from 'sentry/components/errorBoundary';
import IdBadge from 'sentry/components/idBadge';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
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
        <TimeSince date={incident.dateStarted} unitStyle="extraShort" />
      </NoWrapNumeric>
      <NoWrapNumeric>
        {incident.status === IncidentStatus.CLOSED ? (
          <Duration seconds={duration} />
        ) : (
          <Tag variant="warning">{t('Still Active')}</Tag>
        )}
      </NoWrapNumeric>

      <FlexCenter>
        <ProjectBadge avatarSize={18} project={projectsLoaded ? project : {slug}} />
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
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 130px;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const FlexCenter = styled('div')`
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  line-height: 1.6;
`;

const NoWrapNumeric = styled(FlexCenter)`
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

const TeamWrapper = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledActorAvatar = styled(ActorAvatar)`
  margin-right: ${space(1)};
`;

export default AlertListRow;
