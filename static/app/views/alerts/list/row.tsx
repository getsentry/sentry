import {Component} from 'react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';
import moment from 'moment';

import ActorAvatar from 'app/components/avatar/actorAvatar';
import Duration from 'app/components/duration';
import ErrorBoundary from 'app/components/errorBoundary';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import TimeSince from 'app/components/timeSince';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
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

import {TableLayout} from './styles';

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
    const hasAlertOwnership = organization.features.includes('team-alerts-ownership');
    const ownerId = incident.alertRule.owner?.split(':')[1];
    const teamActor = ownerId
      ? {type: 'team' as Actor['type'], id: ownerId, name: ''}
      : null;

    return (
      <ErrorBoundary>
        <IncidentPanelItem>
          <TableLayout>
            <Title>
              <Link to={alertLink}>Alert #{incident.id}</Link>
              <div>
                {t('Triggered ')} <TimeSince date={incident.dateStarted} extraShort />
                <StyledTimeSeparator> | </StyledTimeSeparator>
                {incident.status === IncidentStatus.CLOSED
                  ? tct('Active for [duration]', {
                      duration: (
                        <Duration
                          seconds={getDynamicText({value: duration, fixed: 1200})}
                        />
                      ),
                    })
                  : t('Still Active')}
              </div>
            </Title>

            <div>{incident.title}</div>

            <ProjectBadge
              avatarSize={18}
              project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
            />

            <FlexCenter>
              {hasAlertOwnership &&
                (teamActor ? <ActorAvatar actor={teamActor} size={24} /> : '-')}
            </FlexCenter>
          </TableLayout>
        </IncidentPanelItem>
      </ErrorBoundary>
    );
  }
}

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const StyledTimeSeparator = styled('span')`
  color: ${p => p.theme.gray200};
`;

const Title = styled('span')`
  ${overflowEllipsis}
`;

const IncidentPanelItem = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;

export default AlertListRow;
