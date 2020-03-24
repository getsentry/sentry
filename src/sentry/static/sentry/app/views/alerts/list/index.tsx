import {RouteComponentProps} from 'react-router/lib/Router';
import DocumentTitle from 'react-document-title';
import React from 'react';
import flatten from 'lodash/flatten';
import omit from 'lodash/omit';
import styled from '@emotion/styled';

import {IconAdd, IconSettings} from 'app/icons';
import {Organization} from 'app/types';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {navigateTo} from 'app/actionCreators/navigation';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import BetaTag from 'app/components/betaTag';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ExternalLink from 'app/components/links/externalLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import Projects from 'app/utils/projects';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import {Incident} from '../types';
import {TableLayout, TitleAndSparkLine} from './styles';
import AlertListRow from './row';

const DEFAULT_QUERY_STATUS = 'open';

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

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
                <RightAlignedHeader>{t('Trend')}</RightAlignedHeader>
              </TitleAndSparkLine>
              <div>{t('Project')}</div>
              <div>{t('Status')}</div>
              <div>{t('Start time (duration)')}</div>
              <RightAlignedHeader>{t('Users affected')}</RightAlignedHeader>
              <RightAlignedHeader>{t('Total events')}</RightAlignedHeader>
            </TableLayout>
          </PanelHeader>

          <PanelBody>
            {loading && <LoadingIndicator />}
            {!loading && (
              <React.Fragment>
                {incidentList.length === 0 && this.renderEmpty()}
                <Projects orgId={orgId} slugs={Array.from(allProjectsFromIncidents)}>
                  {({initiallyLoaded, projects}) =>
                    incidentList.map(incident => (
                      <AlertListRow
                        key={incident.id}
                        projectsLoaded={initiallyLoaded}
                        projects={projects}
                        incident={incident}
                        orgId={orgId}
                      />
                    ))
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
  componentDidMount() {
    this.trackView();
  }

  componentDidUpdate(nextProps: Props) {
    if (nextProps.location.query?.status !== this.props.location.query?.status) {
      this.trackView();
    }
  }

  trackView() {
    const {location, organization} = this.props;
    const status = getQueryStatus(location.query.status);

    trackAnalyticsEvent({
      eventKey: 'alert_stream.viewed',
      eventName: 'Alert Stream: Viewed',
      status,
      organization_id: parseInt(organization.id, 10),
    });
  }

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
                  className={isOpenActive ? ' active' : ''}
                  priority={isOpenActive ? 'primary' : 'default'}
                >
                  {t('Active')}
                </Button>
                <Button
                  to={{pathname, query: closedIncidentsQuery}}
                  size="small"
                  className={isClosedActive ? ' active' : ''}
                  priority={isClosedActive ? 'primary' : 'default'}
                >
                  {t('Resolved')}
                </Button>
                <Button
                  to={{pathname, query: allIncidentsQuery}}
                  size="small"
                  className={isAllActive ? ' active' : ''}
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

const RightAlignedHeader = styled('div')`
  text-align: right;
`;

export default withOrganization(IncidentsListContainer);
