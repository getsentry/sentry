import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import CreateAlertButton from 'sentry/components/createAlertButton';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import Projects from 'sentry/utils/projects';
import withOrganization from 'sentry/utils/withOrganization';

import FilterBar from '../filterBar';
import {Incident} from '../types';
import {getQueryStatus, getTeamParams} from '../utils';

import AlertHeader from './header';
import Onboarding from './onboarding';
import AlertListRow from './row';

const DOCS_URL =
  'https://docs.sentry.io/workflow/alerts-notifications/alerts/?_ga=2.21848383.580096147.1592364314-1444595810.1582160976';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
};

type State = {
  incidentList: Incident[];
  /**
   * User has not yet seen the 'alert_stream' welcome prompt for this
   * organization.
   */
  firstVisitShown?: boolean;
  /**
   * Is there at least one alert rule configured for the currently selected
   * projects?
   */
  hasAlertRule?: boolean;
};

class IncidentsList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location} = this.props;
    const {query} = location;

    const status = getQueryStatus(query.status);
    // Filtering by one status, both does nothing
    if (status.length === 1) {
      query.status = status;
    }

    query.team = getTeamParams(query.team);
    query.expand = ['original_alert_rule'];

    return [['incidentList', `/organizations/${params?.orgId}/incidents/`, {query}]];
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
          {t('Create Alert')}
        </CreateAlertButton>
      </Fragment>
    );

    return <Onboarding actions={actions} />;
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
          <PanelTable
            isLoading={showLoadingIndicator}
            isEmpty={incidentList?.length === 0}
            emptyMessage={t('No incidents exist for the current query.')}
            emptyAction={
              <EmptyStateAction>
                {tct('Learn more about [link:Metric Alerts]', {
                  link: <ExternalLink href={DOCS_URL} />,
                })}
              </EmptyStateAction>
            }
            headers={[
              t('Alert Rule'),
              t('Triggered'),
              t('Duration'),
              t('Project'),
              t('Alert ID'),
              t('Team'),
            ]}
          >
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
          </PanelTable>
        )}
        <Pagination pageLinks={incidentListPageLinks} />
      </Fragment>
    );
  }

  renderBody() {
    const {params, organization, router, location} = this.props;
    const {orgId} = params;

    return (
      <SentryDocumentTitle title={t('Alerts')} orgSlug={orgId}>
        <PageFiltersContainer organization={organization} showDateSelector={false}>
          <AlertHeader organization={organization} router={router} activeTab="stream" />
          <StyledLayoutBody>
            <Layout.Main fullWidth>
              {!this.tryRenderOnboarding() && (
                <Fragment>
                  <StyledAlert icon={<IconInfo />}>
                    {t('This page only shows metric alerts.')}
                  </StyledAlert>
                  <FilterBar
                    location={location}
                    onChangeFilter={this.handleChangeFilter}
                    onChangeSearch={this.handleChangeSearch}
                    hasStatusFilters
                  />
                </Fragment>
              )}
              {this.renderList()}
            </Layout.Main>
          </StyledLayoutBody>
        </PageFiltersContainer>
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

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(1.5)};
`;

const StyledLayoutBody = styled(Layout.Body)`
  margin-bottom: -20px;
`;

const EmptyStateAction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

export default withOrganization(IncidentsListContainer);
