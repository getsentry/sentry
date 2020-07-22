import {RouteComponentProps} from 'react-router/lib/Router';
import DocumentTitle from 'react-document-title';
import React from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSettings, IconCheckmark, IconArrow} from 'app/icons';
import {Organization} from 'app/types';
import {IssueAlertRule} from 'app/types/alerts';
import {PageContent, PageHeader} from 'app/styles/organization';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {navigateTo} from 'app/actionCreators/navigation';
import {t, tct} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import NavTabs from 'app/components/navTabs';
import Link from 'app/components/links/link';
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
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {promptsUpdate} from 'app/actionCreators/prompts';

import Onboarding from '../list/onboarding';
import {TableLayout, TitleAndSparkLine} from './styles';
import RuleListRow from './row';

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
  ruleList: IssueAlertRule[];
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
        'ruleList',
        `/organizations/${params && params.orgId}/combined-rules/`,
        {query: {...query, status}},
      ],
    ];
  }

  /**
   * If our ruleList is empty, determine if we've configured alert rules or
   * if the user has seen the welcome prompt.
   */
  async onLoadAllEndpointsSuccess() {
    const {ruleList} = this.state;

    if (ruleList.length !== 0) {
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
  handleNavigateToSettings = (e: React.MouseEvent) => {
    const {router, params} = this.props;
    e.preventDefault();

    navigateTo(`/settings/${params.orgId}/projects/:projectId/alerts/`, router);
  };

  tryRenderOnboarding() {
    const {firstVisitShown} = this.state;

    if (!firstVisitShown) {
      return null;
    }

    const actions = (
      <React.Fragment>
        <Button size="small" external href={DOCS_URL}>
          {t('View Features')}
        </Button>
        <AddAlertRuleButton {...this.props} />
      </React.Fragment>
    );

    return <Onboarding actions={actions} />;
  }

  tryRenderEmpty() {
    const {hasAlertRule, ruleList} = this.state;
    const status = getQueryStatus(this.props.location.query.status);

    if (ruleList.length > 0) {
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
    const {loading, ruleList, incidentListPageLinks, hasAlertRule} = this.state;
    const {location} = this.props;

    const {query} = location;
    const {orgId} = this.props.params;
    // const allProjectsFromRules = new Set(
    //   flatten(ruleList?.map(({projects}) => projects))
    // );
    const checkingForAlertRules =
      ruleList && ruleList.length === 0 && hasAlertRule === undefined ? true : false;
    const showLoadingIndicator = loading || checkingForAlertRules;

    return (
      <React.Fragment>
        {this.tryRenderOnboarding() ?? (
          <Panel>
            {!loading && (
              <PanelHeader>
                <TableLayout>
                  <div>{t('Type')}</div>
                  <div>{t('Alert Name')}</div>
                  <div>{t('Project')}</div>
                  <div>{t('Created By')}</div>
                  <div>
                    {t('Created')}{' '}
                    <IconArrow color="gray500" size="xs" direction="down" />
                  </div>
                  <div>{t('Actions')}</div>
                </TableLayout>
              </PanelHeader>
            )}
            {showLoadingIndicator ? (
              <LoadingIndicator />
            ) : (
              this.tryRenderEmpty() ?? (
                <PanelBody>
                  {ruleList.map(rule => (
                    <RuleListRow
                      key={rule.id}
                      projectsLoaded={false}
                      projects={[]}
                      rule={rule}
                      orgId={orgId}
                    />
                  ))}
                </PanelBody>
              )
            )}
          </Panel>
        )}
        <Pagination pageLinks={incidentListPageLinks} />
      </React.Fragment>
    );
  }

  renderBody() {
    const {loading, firstVisitShown} = this.state;
    const {params, organization} = this.props;
    const {orgId} = params;

    return (
      <DocumentTitle title={`Alerts - ${orgId} - Sentry`}>
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
                </Actions>
              ) : (
                // Keep an empty Actions container around to keep the height of
                // the header correct so we don't jitter between loading
                // states.
                <Actions>{null}</Actions>
              )}
            </PageHeader>

            <NavTabs underlined>
              <li>
                <Link to={`/organizations/${orgId}/alerts/`}>{t('Stream')}</Link>
              </li>
              <li className="active">
                <Link to={`/organizations/${orgId}/alerts/rules/`}>{t('Rules')}</Link>
              </li>
            </NavTabs>
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

          navigateTo(
            `/settings/${params.orgId}/projects/:projectId/alerts/new/?referrer=alert_stream`,
            router
          );
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

const StyledButtonBar = styled(ButtonBar)`
  width: 100px;
  margin-bottom: ${space(1)};
`;

const StyledPageHeading = styled(PageHeading)`
  display: flex;
  align-items: center;
`;

const PaddedTitleAndSparkLine = styled(TitleAndSparkLine)`
  padding-left: ${space(2)};
`;

const Actions = styled(ButtonBar)`
  height: 32px;
`;

export default withOrganization(IncidentsListContainer);
