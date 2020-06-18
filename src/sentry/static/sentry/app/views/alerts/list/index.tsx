import {RouteComponentProps} from 'react-router/lib/Router';
import DocumentTitle from 'react-document-title';
import React from 'react';
import flatten from 'lodash/flatten';
import omit from 'lodash/omit';
import styled from '@emotion/styled';

import {IconAdd, IconSettings, IconCheckmark} from 'app/icons';
import {Organization} from 'app/types';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {navigateTo} from 'app/actionCreators/navigation';
import {t, tct} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import FeatureBadge from 'app/components/featureBadge';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import Projects from 'app/utils/projects';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import Access from 'app/components/acl/access';
import ConfigStore from 'app/stores/configStore';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {promptsUpdate} from 'app/actionCreators/prompts';

import {Incident} from '../types';
import {TableLayout, TitleAndSparkLine} from './styles';
import AlertListRow from './row';

const DEFAULT_QUERY_STATUS = 'open';

const DOCS_URL =
  'https://docs.sentry.io/workflow/alerts-notifications/alerts/?_ga=2.21848383.580096147.1592364314-1444595810.1582160976';

const trackDocumentationClicked = (org: Organization) =>
  trackAnalyticsEvent({
    eventKey: 'alert_stream.documentation_clicked',
    eventName: 'Alert Stream: Documentation Clicked',
    organization_id: org.id,
    user_id: ConfigStore.get('user').id,
  });

function getQueryStatus(status: any): 'open' | 'closed' {
  return ['open', 'closed'].includes(status) ? status : DEFAULT_QUERY_STATUS;
}

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
};

type State = {
  incidentList: Incident[];
  /**
   * Is there at least one alert rule configured for the currently selected
   * projects?
   */
  hasAlertRule?: boolean;
  /**
   * User has not yet seen the 'alert_stream' welcome prompt for this
   * organization.
   */
  firstVisitShown?: boolean;
};

class IncidentsList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): [string, string, any][] {
    const {params, location} = this.props;
    const {query} = location;
    const status = getQueryStatus(query.status);

    return [
      [
        'incidentList',
        `/organizations/${params && params.orgId}/incidents/`,
        {query: {...query, status}},
      ],
    ];
  }

  /**
   * If our incidentList is empty, determine if we've configured alert rules or
   * if the user has seen the welcome prompt.
   */
  async onLoadAllEndpointsSuccess() {
    const {incidentList} = this.state;

    if (incidentList.length !== 0) {
      this.setState({hasAlertRule: true, firstVisitShown: false});
      return;
    }

    this.setState({loading: true});

    // Check if they have rules or not, to know which empty state message to
    // display
    const {params, location, organization} = this.props;

    const alertRules = await this.api.requestPromise(
      `/organizations/${params?.orgId}/alert-rules/`,
      {
        method: 'GET',
        query: location.query,
      }
    );
    const hasAlertRule = alertRules.length > 0;

    // We've already configured alert rules, no need to check if we should show
    // the "first time welcome" prompt
    if (hasAlertRule) {
      this.setState({hasAlertRule, firstVisitShown: false, loading: false});
      return;
    }

    // Check if they have already seen the prompt for the alert stream
    const prompt = await this.api.requestPromise('/promptsactivity/', {
      query: {
        organization_id: organization.id,
        feature: 'alert_stream',
      },
    });

    const firstVisitShown = !prompt?.data?.dismissed_ts;

    if (firstVisitShown) {
      // Prompt has not been seen, mark the prompt as seen immediately so they
      // don't see it again
      promptsUpdate(this.api, {
        feature: 'alert_stream',
        organizationId: organization.id,
        status: 'dismissed',
      });
    }

    this.setState({hasAlertRule, firstVisitShown, loading: false});
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

  tryRenderFirstVisit() {
    const {firstVisitShown} = this.state;

    if (!firstVisitShown) {
      return null;
    }

    return (
      <WelcomeEmptyMessage
        leftAligned
        size="medium"
        title={t('Find the signal in the noise')}
        description={t(
          'You’ve got 5 minutes, 2 million lines of code, and an inbox with 300 new messages. Alerts tell you what went wrong and why.'
        )}
        action={
          <ButtonBar gap={1}>
            <Button size="small" external href={DOCS_URL}>
              {t('View Features')}
            </Button>
            <AddAlertRuleButton {...this.props} />
          </ButtonBar>
        }
      />
    );
  }

  tryRenderEmpty() {
    const {hasAlertRule, incidentList} = this.state;
    const status = getQueryStatus(this.props.location.query.status);

    if (incidentList.length > 0) {
      return null;
    }

    return (
      <EmptyMessage
        size="medium"
        icon={<IconCheckmark isCircled size="48" />}
        title={
          !hasAlertRule
            ? t('No metric alert rules exist for these projects.')
            : status === 'open'
            ? t(
                'Everything’s a-okay. There are no unresolved metric alerts in these projects.'
              )
            : t('There are no resolved metric alerts in these projects.')
        }
        description={tct('Learn more about [link:Metric Alerts]', {
          link: <ExternalLink href={DOCS_URL} />,
        })}
      />
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderList() {
    const {
      loading,
      incidentList,
      incidentListPageLinks,
      hasAlertRule,
      firstVisitShown,
    } = this.state;

    const {orgId} = this.props.params;
    const allProjectsFromIncidents = new Set(
      flatten(incidentList?.map(({projects}) => projects))
    );
    const checkingForAlertRules =
      incidentList && incidentList.length === 0 && hasAlertRule === undefined
        ? true
        : false;
    const showLoadingIndicator = loading || checkingForAlertRules;
    const status = getQueryStatus(this.props.location.query.status);

    return (
      <React.Fragment>
        <Panel>
          {!loading && !firstVisitShown && (
            <StyledPanelHeader>
              <TableLayout status={status}>
                <PaddedTitleAndSparkLine status={status}>
                  <div>{t('Alert')}</div>
                  {status === 'open' && <div>{t('Graph')}</div>}
                </PaddedTitleAndSparkLine>
                <div>{t('Project')}</div>
                <div>{t('Triggered')}</div>
                {status === 'closed' && <div>{t('Duration')}</div>}
                {status === 'closed' && <div>{t('Resolved')}</div>}
              </TableLayout>
            </StyledPanelHeader>
          )}
          {showLoadingIndicator ? (
            <LoadingIndicator />
          ) : (
            this.tryRenderFirstVisit() ??
            this.tryRenderEmpty() ?? (
              <PanelBody>
                <Projects orgId={orgId} slugs={Array.from(allProjectsFromIncidents)}>
                  {({initiallyLoaded, projects}) =>
                    incidentList.map(incident => (
                      <AlertListRow
                        key={incident.id}
                        projectsLoaded={initiallyLoaded}
                        projects={projects}
                        incident={incident}
                        orgId={orgId}
                        filteredStatus={status}
                      />
                    ))
                  }
                </Projects>
              </PanelBody>
            )
          )}
        </Panel>
        <Pagination pageLinks={incidentListPageLinks} />
      </React.Fragment>
    );
  }

  renderBody() {
    const {loading, firstVisitShown} = this.state;
    const {params, location, organization} = this.props;
    const {pathname, query} = location;
    const {orgId} = params;

    const openIncidentsQuery = omit({...query, status: 'open'}, 'cursor');
    const closedIncidentsQuery = omit({...query, status: 'closed'}, 'cursor');

    const status = getQueryStatus(query.status);

    return (
      <DocumentTitle title={`Alerts- ${orgId} - Sentry`}>
        <GlobalSelectionHeader organization={organization} showDateSelector={false}>
          <PageContent>
            <PageHeader>
              <StyledPageHeading>
                {t('Alerts')} <FeatureBadge type="beta" />
              </StyledPageHeading>

              {!loading && !firstVisitShown ? (
                <Actions gap={1}>
                  <AddAlertRuleButton {...this.props} />

                  <Button
                    onClick={this.handleNavigateToSettings}
                    href="#"
                    size="small"
                    icon={<IconSettings size="xs" />}
                  >
                    {t('View Rules')}
                  </Button>

                  <ButtonBar merged active={status}>
                    <Button
                      to={{pathname, query: openIncidentsQuery}}
                      barId="open"
                      size="small"
                    >
                      {t('Active')}
                    </Button>
                    <Button
                      to={{pathname, query: closedIncidentsQuery}}
                      barId="closed"
                      size="small"
                    >
                      {t('Resolved')}
                    </Button>
                  </ButtonBar>
                </Actions>
              ) : (
                // Keep an empty Actions container around to keep the height of
                // the header correct so we don't jitter between loading
                // states.
                <Actions>{null}</Actions>
              )}
            </PageHeader>

            <Alert type="info" icon="icon-circle-info">
              {tct(
                'This page is in beta and currently only shows [link:metric alerts]. [contactLink:Please contact us if you have any feedback.]',
                {
                  link: (
                    <ExternalLink
                      onClick={() => trackDocumentationClicked(organization)}
                      href={DOCS_URL}
                    />
                  ),
                  contactLink: (
                    <ExternalLink href="mailto:alerting-feedback@sentry.io">
                      {t('Please contact us if you have any feedback.')}
                    </ExternalLink>
                  ),
                }
              )}
            </Alert>
            {this.renderList()}
          </PageContent>
        </GlobalSelectionHeader>
      </DocumentTitle>
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
      organization_id: organization.id,
      status,
    });
  }

  render() {
    return <IncidentsList {...this.props} />;
  }
}

const AddAlertRuleButton = ({router, params, organization}: Props) => (
  <Access organization={organization} access={['project:write']}>
    {({hasAccess}) => (
      <Button
        disabled={!hasAccess}
        title={
          !hasAccess
            ? t('Users with admin permission or higher can create alert rules.')
            : undefined
        }
        onClick={e => {
          e.preventDefault();

          navigateTo(`/settings/${params.orgId}/projects/:projectId/alerts/new/`, router);
        }}
        priority="primary"
        href="#"
        size="small"
        icon={<IconAdd isCircled size="xs" />}
      >
        {t('Add Alert Rule')}
      </Button>
    )}
  </Access>
);

const StyledPageHeading = styled(PageHeading)`
  display: flex;
  align-items: center;
`;

const PaddedTitleAndSparkLine = styled(TitleAndSparkLine)`
  padding-left: ${space(2)};
`;

const StyledPanelHeader = styled(PanelHeader)`
  /* Match table row padding for the grid to align */
  padding: ${space(1.5)} ${space(2)} ${space(1.5)} 0;
`;

const Actions = styled(ButtonBar)`
  height: 32px;
`;

const WelcomeEmptyMessage = styled(EmptyMessage)`
  margin: ${space(4)};
  max-width: 550px;
`;

export default withOrganization(IncidentsListContainer);
