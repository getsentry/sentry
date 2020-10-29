import React from 'react';
import memoize from 'lodash/memoize';
import moment from 'moment';
import styled from '@emotion/styled';

import {IconWarning} from 'app/icons';
import {PanelItem} from 'app/components/panels';
import {Project} from 'app/types';
import {t, tct} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import DateTime from 'app/components/dateTime';
import Duration from 'app/components/duration';
import ErrorBoundary from 'app/components/errorBoundary';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import theme from 'app/utils/theme';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {Incident, IncidentStats, IncidentStatus} from '../types';
import {getIncidentMetricPreset} from '../utils';
import {TableLayout, TitleAndSparkLine} from './styles';
import SparkLine from './sparkLine';

type Props = {
  incident: Incident;
  projects: Project[];
  projectsLoaded: boolean;
  orgId: string;
  filteredStatus: 'open' | 'closed';
} & AsyncComponent['props'];

type State = {
  stats: IncidentStats;
} & AsyncComponent['state'];

class AlertListRow extends AsyncComponent<Props, State> {
  get metricPreset() {
    const {incident} = this.props;
    return incident ? getIncidentMetricPreset(incident) : undefined;
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, incident, filteredStatus} = this.props;

    if (filteredStatus === 'open') {
      return [
        ['stats', `/organizations/${orgId}/incidents/${incident.identifier}/stats/`],
      ];
    }

    return [];
  }

  /**
   * Memoized function to find a project from a list of projects
   */
  getProject = memoize((slug: string, projects: Project[]) =>
    projects.find(project => project.slug === slug)
  );

  renderLoading() {
    return this.renderBody();
  }

  renderError() {
    return this.renderBody();
  }

  renderTimeSince(date: string) {
    return (
      <CreatedResolvedTime>
        <Tooltip title={<DateTime date={date} utc={false} />} position="top">
          <TimeSince title="" date={date} />
        </Tooltip>
      </CreatedResolvedTime>
    );
  }

  renderStatusIndicator() {
    const {status} = this.props.incident;
    const isResolved = status === IncidentStatus.CLOSED;
    const isWarning = status === IncidentStatus.WARNING;

    const color = isResolved ? theme.gray400 : isWarning ? theme.orange300 : theme.red300;
    const text = isResolved ? t('Resolved') : isWarning ? t('Warning') : t('Critical');

    return (
      <Tooltip title={tct('Status: [text]', {text})}>
        <StatusIndicator color={color} />
      </Tooltip>
    );
  }

  renderBody() {
    const {incident, orgId, projectsLoaded, projects, filteredStatus} = this.props;
    const {error, stats} = this.state;
    const started = moment(incident.dateStarted);
    const duration = moment
      .duration(moment(incident.dateClosed || new Date()).diff(started))
      .as('seconds');
    const slug = incident.projects[0];

    return (
      <ErrorBoundary>
        <IncidentPanelItem>
          <TableLayout status={filteredStatus}>
            <TitleAndSparkLine status={filteredStatus}>
              <Title>
                {this.renderStatusIndicator()}
                <IncidentLink
                  to={`/organizations/${orgId}/alerts/${incident.identifier}/`}
                >
                  Alert #{incident.id}
                </IncidentLink>
                {incident.title}
              </Title>

              {filteredStatus === 'open' && (
                <SparkLine
                  error={error && <ErrorLoadingStatsIcon />}
                  eventStats={stats?.eventStats}
                />
              )}
            </TitleAndSparkLine>

            <ProjectBadge
              avatarSize={18}
              project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
            />

            {this.renderTimeSince(incident.dateStarted)}

            {filteredStatus === 'closed' && (
              <Duration seconds={getDynamicText({value: duration, fixed: 1200})} />
            )}

            {filteredStatus === 'closed' &&
              incident.dateClosed &&
              this.renderTimeSince(incident.dateClosed)}
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

const CreatedResolvedTime = styled('div')`
  ${overflowEllipsis}
  line-height: 1.4;
  display: flex;
  align-items: center;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const StatusIndicator = styled('div')<{color: string}>`
  width: 10px;
  height: 12px;
  background: ${p => p.color};
  display: inline-block;
  border-top-right-radius: 40%;
  border-bottom-right-radius: 40%;
  margin-bottom: -1px;
`;

const Title = styled('span')`
  ${overflowEllipsis}
`;

const IncidentLink = styled(Link)`
  padding: 0 ${space(1)};
`;

const IncidentPanelItem = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)} ${space(1.5)} 0;
`;

export default AlertListRow;
