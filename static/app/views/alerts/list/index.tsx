import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';
import omit from 'lodash/omit';

import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import CreateAlertButton from 'app/components/createAlertButton';
import * as Layout from 'app/components/layouts/thirds';
import ExternalLink from 'app/components/links/externalLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconCheckmark, IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, Team} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Projects from 'app/utils/projects';
import withOrganization from 'app/utils/withOrganization';
import withTeams from 'app/utils/withTeams';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import TeamFilter, {getTeamParams} from '../rules/teamFilter';
import {Incident} from '../types';

import AlertHeader from './header';
import Onboarding from './onboarding';
import AlertListRow from './row';
import {TableLayout} from './styles';

const DEFAULT_QUERY_STATUS = 'open';

const DOCS_URL =
  'https://docs.sentry.io/workflow/alerts-notifications/alerts/?_ga=2.21848383.580096147.1592364314-1444595810.1582160976';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  teams: Team[];
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
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location, organization} = this.props;
    const {query} = location;

    const status = this.getQueryStatus(query.status);
    // Filting by one status, both does nothing
    if (status.length === 1) {
      query.status = status;
    }

    if (organization.features.includes('team-alerts-ownership')) {
      query.team = getTeamParams(query.team);
    }

    if (organization.features.includes('alert-details-redesign')) {
      query.expand = ['original_alert_rule'];
    }

    return [['incidentList', `/organizations/${params?.orgId}/incidents/`, {query}]];
  }

  getQueryStatus(status: string | string[]): string[] {
    if (Array.isArray(status)) {
      return status;
    }

    if (status === '') {
      return [];
    }

    // No default status w/ alert-history-filters
    const hasAlertHistoryFilters = this.props.organization.features.includes(
      'alert-history-filters'
    );

    return ['open', 'closed'].includes(status as string)
      ? [status as string]
      : hasAlertHistoryFilters
      ? []
      : [DEFAULT_QUERY_STATUS];
  }

  /**
   * If our incidentList is empty, determine if we've configured alert rules or
   * if the user has seen the welcome prompt.
   */
  async onLoadAllEndpointsSuccess() {
    const {incidentList} = this.state;

    if (!incidentList || incidentList.length !== 0) {
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
    const prompt = await promptsCheck(this.api, {
      organizationId: organization.id,
      feature: 'alert_stream',
    });

    const firstVisitShown = !prompt?.dismissedTime;

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

  handleChangeSearch = (title: string) => {
    const {router, location} = this.props;
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        title,
      },
    });
  };

  handleChangeFilter = (sectionId: string, activeFilters: Set<string>) => {
    const {router, location} = this.props;
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

    let team = currentQuery.team;
    if (sectionId === 'teams') {
      team = activeFilters.size ? [...activeFilters] : '';
    }

    let status = currentQuery.status;
    if (sectionId === 'status') {
      status = activeFilters.size ? [...activeFilters] : '';
    }

    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        status,
        // Preserve empty team query parameter
        team: team.length === 0 ? '' : team,
      },
    });
  };

  renderFilterBar() {
    const {teams, location} = this.props;
    const selectedTeams = new Set(getTeamParams(location.query.team));
    const selectedStatus = new Set(this.getQueryStatus(location.query.status));

    return (
      <FilterWrapper>
        <TeamFilter
          showStatus
          teams={teams}
          selectedStatus={selectedStatus}
          selectedTeams={selectedTeams}
          handleChangeFilter={this.handleChangeFilter}
        />
        <StyledSearchBar
          placeholder={t('Search by name')}
          query={location.query?.name}
          onSearch={this.handleChangeSearch}
        />
      </FilterWrapper>
    );
  }

  tryRenderOnboarding() {
    const {firstVisitShown} = this.state;
    const {organization} = this.props;

    if (!firstVisitShown) {
      return null;
    }

    const actions = (
      <Fragment>
        <Button size="small" external href={DOCS_URL}>
          {t('View Features')}
        </Button>
        <CreateAlertButton
          organization={organization}
          iconProps={{size: 'xs'}}
          size="small"
          priority="primary"
          referrer="alert_stream"
        >
          {t('Create Alert Rule')}
        </CreateAlertButton>
      </Fragment>
    );

    return <Onboarding actions={actions} />;
  }

  tryRenderEmpty() {
    const {incidentList} = this.state;

    if (!incidentList || incidentList.length > 0) {
      return null;
    }

    return (
      <EmptyMessage
        size="medium"
        icon={<IconCheckmark isCircled size="48" />}
        title={t('No incidents exist for the current query.')}
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
    const {loading, incidentList, incidentListPageLinks, hasAlertRule} = this.state;
    const {
      params: {orgId},
      organization,
    } = this.props;

    const allProjectsFromIncidents = new Set(
      flatten(incidentList?.map(({projects}) => projects))
    );
    const checkingForAlertRules =
      incidentList && incidentList.length === 0 && hasAlertRule === undefined
        ? true
        : false;
    const showLoadingIndicator = loading || checkingForAlertRules;

    return (
      <Fragment>
        {this.tryRenderOnboarding() ?? (
          <Panel>
            {!loading && (
              <PanelHeader>
                <TableLayout>
                  <div>{t('Alert')}</div>
                  <div>{t('Alert Rule')}</div>
                  <div>{t('Project')}</div>
                  <div>
                    <Feature
                      features={['team-alerts-ownership']}
                      organization={organization}
                    >
                      {t('Team')}
                    </Feature>
                  </div>
                </TableLayout>
              </PanelHeader>
            )}
            {showLoadingIndicator ? (
              <LoadingIndicator />
            ) : (
              this.tryRenderEmpty() ?? (
                <PanelBody>
                  <Projects orgId={orgId} slugs={Array.from(allProjectsFromIncidents)}>
                    {({initiallyLoaded, projects}) =>
                      incidentList.map(incident => (
                        <AlertListRow
                          key={incident.id}
                          projectsLoaded={initiallyLoaded}
                          projects={projects as Project[]}
                          incident={incident}
                          orgId={orgId}
                          organization={organization}
                        />
                      ))
                    }
                  </Projects>
                </PanelBody>
              )
            )}
          </Panel>
        )}
        <Pagination pageLinks={incidentListPageLinks} />
      </Fragment>
    );
  }

  renderBody() {
    const {params, organization, router, location} = this.props;
    const {pathname, query} = location;
    const {orgId} = params;

    const openIncidentsQuery = omit({...query, status: 'open'}, 'cursor');
    const closedIncidentsQuery = omit({...query, status: 'closed'}, 'cursor');
    const status = this.getQueryStatus(location.query.status)[0] || DEFAULT_QUERY_STATUS;
    const hasAlertHistoryFilters = organization.features.includes(
      'alert-history-filters'
    );

    return (
      <SentryDocumentTitle title={t('Alerts')} orgSlug={orgId}>
        <GlobalSelectionHeader organization={organization} showDateSelector={false}>
          <AlertHeader organization={organization} router={router} activeTab="stream" />
          <StyledLayoutBody>
            <Layout.Main fullWidth>
              {!this.tryRenderOnboarding() && (
                <Fragment>
                  <Feature
                    features={['alert-details-redesign']}
                    organization={organization}
                  >
                    <StyledAlert icon={<IconInfo />}>
                      {t('This page only shows metric alerts.')}
                    </StyledAlert>
                  </Feature>
                  {hasAlertHistoryFilters ? (
                    this.renderFilterBar()
                  ) : (
                    <StyledButtonBar merged active={status}>
                      <Button
                        to={{pathname, query: openIncidentsQuery}}
                        barId="open"
                        size="small"
                      >
                        {t('Unresolved')}
                      </Button>
                      <Button
                        to={{pathname, query: closedIncidentsQuery}}
                        barId="closed"
                        size="small"
                      >
                        {t('Resolved')}
                      </Button>
                    </StyledButtonBar>
                  )}
                </Fragment>
              )}
              {this.renderList()}
            </Layout.Main>
          </StyledLayoutBody>
        </GlobalSelectionHeader>
      </SentryDocumentTitle>
    );
  }
}

class IncidentsListContainer extends Component<Props> {
  componentDidMount() {
    this.trackView();
  }

  componentDidUpdate(nextProps: Props) {
    if (nextProps.location.query?.status !== this.props.location.query?.status) {
      this.trackView();
    }
  }

  trackView() {
    const {organization} = this.props;

    trackAnalyticsEvent({
      eventKey: 'alert_stream.viewed',
      eventName: 'Alert Stream: Viewed',
      organization_id: organization.id,
    });
  }

  renderNoAccess() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </Layout.Main>
      </Layout.Body>
    );
  }

  render() {
    const {organization} = this.props;

    return (
      <Feature
        features={['organizations:incidents']}
        organization={organization}
        hookName="feature-disabled:alerts-page"
        renderDisabled={this.renderNoAccess}
      >
        <IncidentsList {...this.props} />
      </Feature>
    );
  }
}

const StyledButtonBar = styled(ButtonBar)`
  width: 100px;
  margin-bottom: ${space(1)};
`;

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(1.5)};
`;

const FilterWrapper = styled('div')`
  display: flex;
  margin-bottom: ${space(1.5)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-left: ${space(1.5)};
`;

const StyledLayoutBody = styled(Layout.Body)`
  margin-bottom: -20px;
`;

export default withOrganization(withTeams(IncidentsListContainer));
