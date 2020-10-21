import {RouteComponentProps} from 'react-router/lib/Router';
import { Component, Fragment } from 'react';
import flatten from 'lodash/flatten';
import omit from 'lodash/omit';
import styled from '@emotion/styled';

import {IconCheckmark} from 'app/icons';
import {Organization, Project} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import AsyncComponent from 'app/components/asyncComponent';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import * as Layout from 'app/components/layouts/thirds';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import Projects from 'app/utils/projects';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {promptsUpdate} from 'app/actionCreators/prompts';
import Alert from 'app/components/alert';

import {Incident} from '../types';
import AlertHeader from './header';
import {TableLayout, TitleAndSparkLine} from './styles';
import AlertListRow from './row';
import CreateRuleButton from './createRuleButton';
import Onboarding from './onboarding';

const DEFAULT_QUERY_STATUS = 'open';

const DOCS_URL =
  'https://docs.sentry.io/workflow/alerts-notifications/alerts/?_ga=2.21848383.580096147.1592364314-1444595810.1582160976';

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

  tryRenderOnboarding() {
    const {firstVisitShown} = this.state;

    if (!firstVisitShown) {
      return null;
    }

    const actions = (
      <Fragment>
        <Button size="small" external href={DOCS_URL}>
          {t('View Features')}
        </Button>
        <CreateRuleButton
          {...this.props}
          iconProps={{size: 'xs'}}
          buttonProps={{size: 'small'}}
        />
      </Fragment>
    );

    return <Onboarding actions={actions} />;
  }

  tryRenderEmpty() {
    const {hasAlertRule, incidentList} = this.state;
    const status = getQueryStatus(this.props.location.query.status);

    if (!incidentList || incidentList.length > 0) {
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
            ? t('No unresolved metric alerts in these projects.')
            : t('No resolved metric alerts in these projects.')
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
    const {loading, incidentList, incidentListPageLinks, hasAlertRule} = this.state;

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
      <Fragment>
        {this.tryRenderOnboarding() ?? (
          <Panel>
            {!loading && (
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
                          filteredStatus={status}
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
    const {params, location, organization, router} = this.props;
    const {pathname, query} = location;
    const {orgId} = params;

    const openIncidentsQuery = omit({...query, status: 'open'}, 'cursor');
    const closedIncidentsQuery = omit({...query, status: 'closed'}, 'cursor');

    const status = getQueryStatus(query.status);

    return (
      <SentryDocumentTitle title={t('Alerts')} objSlug={orgId}>
        <GlobalSelectionHeader organization={organization} showDateSelector={false}>
          <AlertHeader organization={organization} router={router} activeTab="stream" />
          <Layout.Body>
            <Layout.Main fullWidth>
              {!this.tryRenderOnboarding() && (
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
              {this.renderList()}
            </Layout.Main>
          </Layout.Body>
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
    const {location, organization} = this.props;
    const status = getQueryStatus(location.query.status);

    trackAnalyticsEvent({
      eventKey: 'alert_stream.viewed',
      eventName: 'Alert Stream: Viewed',
      organization_id: organization.id,
      status,
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

const PaddedTitleAndSparkLine = styled(TitleAndSparkLine)`
  padding-left: ${space(2)};
`;

const StyledPanelHeader = styled(PanelHeader)`
  /* Match table row padding for the grid to align */
  padding: ${space(1.5)} ${space(2)} ${space(1.5)} 0;
`;

export default withOrganization(IncidentsListContainer);
