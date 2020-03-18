import {RouteComponentProps} from 'react-router/lib/Router';
import DocumentTitle from 'react-document-title';
import React from 'react';
import flatten from 'lodash/flatten';
import memoize from 'lodash/memoize';
import moment from 'moment';
import omit from 'lodash/omit';
import styled from '@emotion/styled';

import {IconAdd, IconSettings} from 'app/icons';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {navigateTo} from 'app/actionCreators/navigation';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import BetaTag from 'app/components/betaTag';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Count from 'app/components/count';
import Duration from 'app/components/duration';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ExternalLink from 'app/components/links/externalLink';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import Projects from 'app/utils/projects';
import getDynamicText from 'app/utils/getDynamicText';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {Incident} from '../types';
import SparkLine from './sparkLine';
import Status from '../status';

const DEFAULT_QUERY_STATUS = 'open';

type Props = RouteComponentProps<{orgId: string}, {}>;

type State = {
  incidentList: Incident[];
};

function getQueryStatus(status: any) {
  return ['open', 'closed', 'all'].includes(status) ? status : DEFAULT_QUERY_STATUS;
}

class IncidentsList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): [string, string, any][] {
    const {params, location} = this.props;
    const {query} = location;
    const status = getQueryStatus(query.status);

    return [
      [
        'incidentList',
        `/organizations/${params && params.orgId}/incidents/`,
        {
          query: {...query, status},
        },
      ],
    ];
  }

  /**
   * Memoized function to find a project from a list of projects
   */
  getProject = memoize((slug, projects) =>
    projects.find(project => project.slug === slug)
  );

  renderListItem({incident, initiallyLoaded, projects}) {
    const {orgId} = this.props.params;
    const started = moment(incident.dateStarted);
    const duration = moment
      .duration(moment(incident.dateClosed || new Date()).diff(started))
      .as('seconds');
    const slug = incident.projects[0];

    return (
      <IncidentPanelItem key={incident.id}>
        <TableLayout>
          <TitleAndSparkLine>
            <TitleLink to={`/organizations/${orgId}/alerts/${incident.identifier}/`}>
              {incident.title}
            </TitleLink>
            <SparkLine incident={incident} />
          </TitleAndSparkLine>
          <ProjectColumn>
            <IdBadge
              project={!initiallyLoaded ? {slug} : this.getProject(slug, projects)}
            />
          </ProjectColumn>
          <Status incident={incident} />
          <div>
            {started.format('L')}
            <LightDuration seconds={getDynamicText({value: duration, fixed: 1200})} />
          </div>
          <NumericColumn>
            <Count value={incident.uniqueUsers} />
          </NumericColumn>
          <NumericColumn>
            <Count value={incident.totalEvents} />
          </NumericColumn>
        </TableLayout>
      </IncidentPanelItem>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t("You don't have any Metric Alerts yet")}</p>
      </EmptyStateWarning>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {loading, incidentList, incidentListPageLinks} = this.state;
    const {orgId} = this.props.params;

    const allProjectsFromIncidents = new Set(
      flatten(incidentList?.map(({projects}) => projects))
    );

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>
            <TableLayout>
              <TitleAndSparkLine>
                <div>{t('Alert')}</div>
                <div>{t('Trend')}</div>
              </TitleAndSparkLine>
              <div>{t('Project')}</div>
              <div>{t('Status')}</div>
              <div>{t('Start time (duration)')}</div>
              <NumericColumn>{t('Users affected')}</NumericColumn>
              <NumericColumn>{t('Total events')}</NumericColumn>
            </TableLayout>
          </PanelHeader>

          <PanelBody>
            {loading && <LoadingIndicator />}
            {!loading && (
              <React.Fragment>
                {incidentList.length === 0 && this.renderEmpty()}
                <Projects orgId={orgId} slugs={Array.from(allProjectsFromIncidents)}>
                  {({initiallyLoaded, projects}) =>
                    incidentList.map(incident =>
                      this.renderListItem({incident, initiallyLoaded, projects})
                    )
                  }
                </Projects>
              </React.Fragment>
            )}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={incidentListPageLinks} />
      </React.Fragment>
    );
  }
}

class IncidentsListContainer extends React.Component<Props> {
  /**
   * Incidents list is currently at the organization level, but the link needs to
   * go down to a specific project scope.
   */
  handleAddAlertRule = (e: React.MouseEvent) => {
    const {router, params} = this.props;
    e.preventDefault();

    navigateTo(`/settings/${params.orgId}/projects/:projectId/alerts/new/`, router);
  };

  /**
   * Incidents list is currently at the organization level, but the link needs to
   * go down to a specific project scope.
   */
  handleNavigateToSettings = (e: React.MouseEvent) => {
    const {router, params} = this.props;
    e.preventDefault();

    navigateTo(`/settings/${params.orgId}/projects/:projectId/alerts/`, router);
  };

  render() {
    const {params, location} = this.props;
    const {pathname, query} = location;
    const {orgId} = params;

    const openIncidentsQuery = omit({...query, status: 'open'}, 'cursor');
    const closedIncidentsQuery = omit({...query, status: 'closed'}, 'cursor');
    const allIncidentsQuery = omit({...query, status: 'all'}, 'cursor');

    const status = getQueryStatus(query.status);

    const isOpenActive = status === 'open';
    const isClosedActive = status === 'closed';
    const isAllActive = status === 'all';

    return (
      <DocumentTitle title={`Alerts- ${orgId} - Sentry`}>
        <PageContent>
          <PageHeader>
            <StyledPageHeading>
              {t('Alerts')}{' '}
              <BetaTag
                title={t(
                  'This feature may change in the future and currently only shows metric alerts'
                )}
              />
            </StyledPageHeading>

            <Actions>
              <Button
                onClick={this.handleAddAlertRule}
                priority="primary"
                href="#"
                size="small"
                icon={<IconAdd circle size="xs" />}
              >
                {t('Add Alert Rule')}
              </Button>

              <Button
                onClick={this.handleNavigateToSettings}
                href="#"
                size="small"
                icon={<IconSettings size="xs" />}
              >
                {t('Settings')}
              </Button>

              <ButtonBar merged>
                <Button
                  to={{pathname, query: openIncidentsQuery}}
                  size="small"
                  priority={isOpenActive ? 'primary' : 'default'}
                >
                  {t('Active')}
                </Button>
                <Button
                  to={{pathname, query: closedIncidentsQuery}}
                  size="small"
                  priority={isClosedActive ? 'primary' : 'default'}
                >
                  {t('Resolved')}
                </Button>
                <Button
                  to={{pathname, query: allIncidentsQuery}}
                  size="small"
                  priority={isAllActive ? 'primary' : 'default'}
                >
                  {t('All')}
                </Button>
              </ButtonBar>
            </Actions>
          </PageHeader>

          <Alert type="info" icon="icon-circle-info">
            {t('This feature is in beta and currently shows only metric alerts. ')}

            <FeedbackLink href="mailto:alerting-feedback@sentry.io">
              {t('Please contact us if you have any feedback.')}
            </FeedbackLink>
          </Alert>
          <IncidentsList {...this.props} />
        </PageContent>
      </DocumentTitle>
    );
  }
}

const StyledPageHeading = styled(PageHeading)`
  display: flex;
  align-items: center;
`;

const FeedbackLink = styled(ExternalLink)`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-left: ${space(1)};
`;

const Actions = styled('div')`
  display: grid;
  align-items: center;
  grid-gap: ${space(1)};
  grid-auto-flow: column;
`;

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 4fr 1fr 1fr 2fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const LightDuration = styled(Duration)`
  color: ${p => p.theme.gray1};
  font-size: 0.9em;
  margin-left: ${space(1)};
`;

const TitleAndSparkLine = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: ${space(2)};
  overflow: hidden;
`;

const TitleLink = styled(Link)`
  ${overflowEllipsis}
`;

const IncidentPanelItem = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
`;

const ProjectColumn = styled('div')`
  overflow: hidden;
`;

const NumericColumn = styled('div')`
  text-align: right;
`;

export default IncidentsListContainer;
