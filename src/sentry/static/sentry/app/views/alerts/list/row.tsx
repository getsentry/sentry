import React from 'react';
import memoize from 'lodash/memoize';
import moment from 'moment';
import styled from '@emotion/styled';

import {IconWarning} from 'app/icons';
import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Count from 'app/components/count';
import Duration from 'app/components/duration';
import ErrorBoundary from 'app/components/errorBoundary';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import Projects from 'app/utils/projects';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {Incident, IncidentStats} from '../types';
import {TableLayout, TitleAndSparkLine} from './styles';
import SparkLine from './sparkLine';
import Status from '../status';

type Props = {
  incident: Incident;
  projects: Parameters<React.ComponentProps<typeof Projects>['children']>[0]['projects'];
  projectsLoaded: boolean;
  orgId: string;
} & AsyncComponent['props'];

type State = {
  stats: IncidentStats;
} & AsyncComponent['state'];

class AlertListRow extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, incident} = this.props;
    return [['stats', `/organizations/${orgId}/incidents/${incident.identifier}/stats/`]];
  }
  /**
   * Memoized function to find a project from a list of projects
   */
  getProject = memoize((slug, projects) =>
    projects.find(project => project.slug === slug)
  );

  renderLoading() {
    return this.renderBody();
  }

  renderError() {
    return this.renderBody();
  }

  renderBody() {
    const {incident, orgId, projectsLoaded, projects} = this.props;
    const {loading, error, stats} = this.state;
    const started = moment(incident.dateStarted);
    const duration = moment
      .duration(moment(incident.dateClosed || new Date()).diff(started))
      .as('seconds');
    const slug = incident.projects[0];

    return (
      <ErrorBoundary>
        <IncidentPanelItem>
          <TableLayout>
            <TitleAndSparkLine>
              <TitleLink to={`/organizations/${orgId}/alerts/${incident.identifier}/`}>
                {incident.title}
              </TitleLink>

              <SparkLine
                error={error && <ErrorLoadingStatsIcon />}
                eventStats={stats?.eventStats}
              />
            </TitleAndSparkLine>

            <ProjectBadge
              avatarSize={18}
              project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
            />

            <Status incident={incident} />

            <div>
              {started.format('L')}
              <LightDuration seconds={getDynamicText({value: duration, fixed: 1200})} />
            </div>

            <NumericColumn>
              {!loading && !error ? (
                <Count value={stats?.uniqueUsers} />
              ) : (
                <NumericPlaceholder error={error && <ErrorLoadingStatsIcon />} />
              )}
            </NumericColumn>

            <NumericColumn>
              {!loading && !error ? (
                <Count value={stats?.totalEvents} />
              ) : (
                <NumericPlaceholder error={error && <ErrorLoadingStatsIcon />} />
              )}
            </NumericColumn>
          </TableLayout>
        </IncidentPanelItem>
      </ErrorBoundary>
    );
  }
}

function ErrorLoadingStatsIcon() {
  return (
    <Tooltip title={t('Error loading alert stats')}>
      <IconWarning />
    </Tooltip>
  );
}

const LightDuration = styled(Duration)`
  color: ${p => p.theme.gray400};
  font-size: 0.9em;
  margin-left: ${space(1)};
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const TitleLink = styled(Link)`
  ${overflowEllipsis}
`;

const IncidentPanelItem = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
`;

const NumericPlaceholder = styled(Placeholder)<{error?: React.ReactNode}>`
  ${p =>
    p.error &&
    `
    align-items: center;
    line-height: 1;
    `}
  height: 100%;
`;

const NumericColumn = styled('div')`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

export default AlertListRow;
