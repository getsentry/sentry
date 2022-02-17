import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';
import moment from 'moment';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Duration from 'sentry/components/duration';
import ErrorBoundary from 'sentry/components/errorBoundary';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import Tag from 'sentry/components/tag';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Actor, Organization, Project} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import getDynamicText from 'sentry/utils/getDynamicText';

import {
  API_INTERVAL_POINTS_LIMIT,
  API_INTERVAL_POINTS_MIN,
} from '../rules/details/constants';
import {Incident, IncidentStatus} from '../types';
import {alertDetailsLink, getIncidentMetricPreset} from '../utils';

/**
 * Retrieve the start/end for showing the graph of the metric
 * Will show at least 150 and no more than 10,000 data points
 */
export const makeRuleDetailsQuery = (
  incident: Incident
): {end: string; start: string} => {
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
  orgId: string;
  organization: Organization;
  projects: Project[];
  projectsLoaded: boolean;
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
    const {incident, projectsLoaded, projects, organization} = this.props;
    const slug = incident.projects[0];
    const started = moment(incident.dateStarted);
    const duration = moment
      .duration(moment(incident.dateClosed || new Date()).diff(started))
      .as('seconds');

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
        <Title data-test-id="alert-title">
          <Link to={alertLink}>{incident.title}</Link>
        </Title>

        <NoWrapNumeric>
          {getDynamicText({
            value: <TimeSince date={incident.dateStarted} extraShort />,
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

        <ProjectBadge
          avatarSize={18}
          project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
        />
        <NoWrapNumeric>#{incident.id}</NoWrapNumeric>

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

const NoWrapNumeric = styled('div')`
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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
