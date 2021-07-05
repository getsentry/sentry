import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';
import moment from 'moment';

import ActorAvatar from 'app/components/avatar/actorAvatar';
import Duration from 'app/components/duration';
import ErrorBoundary from 'app/components/errorBoundary';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import Tag from 'app/components/tag';
import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';
import TeamStore from 'app/stores/teamStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Actor, Organization, Project} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import getDynamicText from 'app/utils/getDynamicText';
import {alertDetailsLink} from 'app/views/alerts/details';

import {
  API_INTERVAL_POINTS_LIMIT,
  API_INTERVAL_POINTS_MIN,
} from '../rules/details/constants';
import {Incident, IncidentStatus} from '../types';
import {getIncidentMetricPreset, isIssueAlert} from '../utils';

/**
 * Retrieve the start/end for showing the graph of the metric
 * Will show at least 150 and no more than 10,000 data points
 */
export const makeRuleDetailsQuery = (
  incident: Incident
): {start: string; end: string} => {
  const {timeWindow} = incident.alertRule;
  const timeWindowMillis = timeWindow * 60 * 1000;
  const minRange = timeWindowMillis * API_INTERVAL_POINTS_MIN;
  const maxRange = timeWindowMillis * API_INTERVAL_POINTS_LIMIT;
  const now = moment.utc();
  const startDate = moment.utc(incident.dateStarted);
  // make a copy of now since we will modify endDate and use now for comparing
  const endDate = incident.dateClosed ? moment.utc(incident.dateClosed) : moment(now);
  const incidentRange = Math.max(endDate.diff(startDate), 3 * timeWindowMillis);
  const range = Math.min(maxRange, Math.max(minRange, incidentRange));
  const halfRange = moment.duration(range / 2);

  return {
    start: getUtcDateString(startDate.subtract(halfRange)),
    end: getUtcDateString(moment.min(endDate.add(halfRange), now)),
  };
};

type Props = {
  incident: Incident;
  projects: Project[];
  projectsLoaded: boolean;
  orgId: string;
  organization: Organization;
};

class AlertListRow extends Component<Props> {
  get metricPreset() {
    const {incident} = this.props;
    return incident ? getIncidentMetricPreset(incident) : undefined;
  }

  /**
   * Memoized function to find a project from a list of projects
   */
  getProject = memoize((slug: string, projects: Project[]) =>
    projects.find(project => project.slug === slug)
  );

  render() {
    const {incident, orgId, projectsLoaded, projects, organization} = this.props;
    const slug = incident.projects[0];
    const started = moment(incident.dateStarted);
    const duration = moment
      .duration(moment(incident.dateClosed || new Date()).diff(started))
      .as('seconds');

    const hasRedesign =
      !isIssueAlert(incident.alertRule) &&
      organization.features.includes('alert-details-redesign');

    const alertLink = hasRedesign
      ? {
          pathname: alertDetailsLink(organization, incident),
          query: {alert: incident.identifier},
        }
      : {
          pathname: `/organizations/${orgId}/alerts/${incident.identifier}/`,
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
        <Title>
          <Link to={alertLink}>{incident.title}</Link>
        </Title>

        <NoWrap>
          {getDynamicText({
            value: <TimeSince date={incident.dateStarted} extraShort />,
            fixed: '1w ago',
          })}
        </NoWrap>
        <NoWrap>
          {incident.status === IncidentStatus.CLOSED ? (
            <Duration seconds={getDynamicText({value: duration, fixed: 1200})} />
          ) : (
            <Tag type="warning">{t('Still Active')}</Tag>
          )}
        </NoWrap>

        <ProjectBadge
          avatarSize={18}
          project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
        />
        <div>#{incident.id}</div>

        <FlexCenter>
          {teamActor ? (
            <Fragment>
              <StyledActorAvatar actor={teamActor} size={24} hasTooltip={false} />{' '}
              <TeamWrapper>{teamActor.name}</TeamWrapper>
            </Fragment>
          ) : (
            '-'
          )}
        </FlexCenter>
      </ErrorBoundary>
    );
  }
}

const Title = styled('div')`
  ${overflowEllipsis}
  min-width: 130px;
`;

const NoWrap = styled('div')`
  white-space: nowrap;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const FlexCenter = styled('div')`
  ${overflowEllipsis}
  display: flex;
  align-items: center;
`;

const TeamWrapper = styled('span')`
  ${overflowEllipsis}
`;

const StyledActorAvatar = styled(ActorAvatar)`
  margin-right: ${space(1)};
`;

export default AlertListRow;
