import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import Feature from 'sentry/components/acl/feature';
import {LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert/alert';
import CreateAlertButton from 'sentry/components/createAlertButton';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import Projects from 'sentry/utils/projects';

import FilterBar from '../../filterBar';
import type {Incident} from '../../types';
import {getQueryStatus, getTeamParams} from '../../utils';
import AlertHeader from '../header';
import Onboarding from '../onboarding';

import AlertListRow from './row';

const DOCS_URL =
  'https://docs.sentry.io/workflow/alerts-notifications/alerts/?_ga=2.21848383.580096147.1592364314-1444595810.1582160976';

type Props = RouteComponentProps & {
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

class IncidentsList extends DeprecatedAsyncComponent<
  Props,
  State & DeprecatedAsyncComponent['state']
> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;
    const {query} = location;
    const status = getQueryStatus(query.status);

    return [
      [
        'incidentList',
        `/organizations/${organization.slug}/incidents/`,
        {
          query: {
            ...query,
            status: status === 'all' ? undefined : status,
            team: getTeamParams(query.team),
            expand: ['original_alert_rule'],
          },
        },
      ],
    ];
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
    const {location, organization} = this.props;

    const alertRules = await this.api.requestPromise(
      `/organizations/${organization.slug}/alert-rules/`,
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
      organization,
      feature: 'alert_stream',
    });

    const firstVisitShown = !prompt?.dismissedTime;

    if (firstVisitShown) {
      // Prompt has not been seen, mark the prompt as seen immediately so they
      // don't see it again
      promptsUpdate(this.api, {
        organization,
        feature: 'alert_stream',
        status: 'dismissed',
      });
    }

    this.setState({hasAlertRule, firstVisitShown, loading: false});
  }

  get projectsFromIncidents() {
    const {incidentList} = this.state;

    return [...new Set(incidentList?.flatMap(({projects}) => projects))];
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

  handleChangeFilter = (activeFilters: string[]) => {
    const {router, location} = this.props;
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        // Preserve empty team query parameter
        team: activeFilters.length > 0 ? activeFilters : '',
      },
    });
  };

  handleChangeStatus = (value: string): void => {
    const {router, location} = this.props;
    const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        status: value === 'all' ? undefined : value,
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
        <LinkButton size="sm" external href={DOCS_URL}>
          {t('View Features')}
        </LinkButton>
        <CreateAlertButton
          organization={organization}
          iconProps={{size: 'xs'}}
          size="sm"
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
    const {organization} = this.props;

    const checkingForAlertRules =
      incidentList?.length === 0 && hasAlertRule === undefined;
    const showLoadingIndicator = loading || checkingForAlertRules;

    return (
      <Fragment>
        {this.tryRenderOnboarding() ?? (
          <StyledPanelTable
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
            <Projects orgId={organization.slug} slugs={this.projectsFromIncidents}>
              {({initiallyLoaded, projects}) =>
                incidentList.map(incident => (
                  <AlertListRow
                    key={incident.id}
                    projectsLoaded={initiallyLoaded}
                    projects={projects as Project[]}
                    incident={incident}
                    organization={organization}
                  />
                ))
              }
            </Projects>
          </StyledPanelTable>
        )}
        <Pagination pageLinks={incidentListPageLinks} />
      </Fragment>
    );
  }

  renderBody() {
    const {organization, location} = this.props;

    return (
      <SentryDocumentTitle title={t('Alerts')} orgSlug={organization.slug}>
        <PageFiltersContainer>
          <AlertHeader activeTab="stream" />
          <Layout.Body>
            <Layout.Main fullWidth>
              {!this.tryRenderOnboarding() && (
                <Fragment>
                  <StyledAlert type="info" showIcon>
                    {t('This page only shows metric alerts.')}
                  </StyledAlert>
                  <FilterBar
                    location={location}
                    onChangeFilter={this.handleChangeFilter}
                    onChangeSearch={this.handleChangeSearch}
                    onChangeStatus={this.handleChangeStatus}
                    hasStatusFilters
                  />
                </Fragment>
              )}
              {this.renderList()}
            </Layout.Main>
          </Layout.Body>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    );
  }
}

function IncidentsListContainer(props: Props) {
  useEffect(() => {
    trackAnalytics('alert_stream.viewed', {
      organization: props.organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderDisabled = () => (
    <Layout.Body>
      <Layout.Main fullWidth>
        <Alert.Container>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </Alert.Container>
      </Layout.Main>
    </Layout.Body>
  );

  return (
    <Feature
      features="incidents"
      hookName="feature-disabled:alerts-page"
      renderDisabled={renderDisabled}
    >
      <IncidentsList {...props} />
    </Feature>
  );
}

const StyledPanelTable = styled(PanelTable)`
  font-size: ${p => p.theme.fontSizeMedium};

  & > div {
    padding: ${space(1.5)} ${space(2)};
  }
`;

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(1.5)};
`;

const EmptyStateAction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

export default IncidentsListContainer;
