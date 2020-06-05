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
import {PRESET_AGGREGATES} from 'app/views/settings/incidentRules/presets';
import {Dataset} from 'app/views/settings/incidentRules/types';
import {use24Hours} from 'app/utils/dates';

import {Incident, IncidentStats} from '../types';
import {TableLayout, TitleAndSparkLine} from './styles';
import SparkLine from './sparkLine';

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
  // TODO: share with detail/body.tsx
  get metricPreset() {
    const alertRule = this.props.incident?.alertRule;
    const aggregate = alertRule?.aggregate;
    const dataset = alertRule?.dataset ?? Dataset.ERRORS;

    return PRESET_AGGREGATES.find(
      p => p.validDataset.includes(dataset) && p.match.test(aggregate ?? '')
    );
  }

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
    const dateFormat = use24Hours() ? 'MMM D, YYYY HH:mm' : 'lll';

    return (
      <ErrorBoundary>
        <IncidentPanelItem>
          <TableLayout>
            <TitleAndSparkLine>
              <Title>
                <TitleLink to={`/organizations/${orgId}/alerts/${incident.identifier}/`}>
                  #{incident.id}
                </TitleLink>
                {incident.title}
              </Title>

              <SparkLine
                error={error && <ErrorLoadingStatsIcon />}
                eventStats={stats?.eventStats}
              />
            </TitleAndSparkLine>

            <NumericColumn>
              {!loading && !error ? (
                <React.Fragment>
                  <span>
                    {this.metricPreset?.name ?? t('Custom metric')}
                    {': '}
                  </span>
                  <Count
                    value={
                      stats?.eventStats.data[stats.eventStats.data.length - 1][1][0]
                        ?.count || 0
                    }
                  />
                </React.Fragment>
              ) : (
                <NumericPlaceholder error={error && <ErrorLoadingStatsIcon />} />
              )}
            </NumericColumn>

            <ProjectBadge
              avatarSize={18}
              project={!projectsLoaded ? {slug} : this.getProject(slug, projects)}
            />

            <TriggeredTime>
              <Duration seconds={getDynamicText({value: duration, fixed: 1200})} />{' '}
              {t('ago')}
              <br />
              <AlertStartedLight>{started.format(dateFormat)}</AlertStartedLight>
            </TriggeredTime>
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

const TriggeredTime = styled('div')`
  line-height: 1.4;
`;

const AlertStartedLight = styled('span')`
  color: ${p => p.theme.gray500};
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const Title = styled('span')`
  ${overflowEllipsis}
`;

const TitleLink = styled(Link)`
  margin-right: ${space(1)};
`;

const IncidentPanelItem = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)};
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
`;

export default AlertListRow;
