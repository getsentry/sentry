import React from 'react';
import {browserHistory, PlainRoute, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {createDashboard} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Controls from './controls';
import Dashboard from './dashboard';
import {DEFAULT_STATS_PERIOD, EMPTY_DASHBOARD} from './data';
import DashboardTitle from './title';
import {DashboardDetails, DashboardState, Widget} from './types';
import {cloneDashboard} from './utils';

const UNSAVED_MESSAGE = t('You have unsaved changes, are you sure you want to leave?');

type Props = {
  api: Client;
  organization: Organization;
  route: PlainRoute;
} & WithRouterProps<{orgId: string; dashboardId: string}, {}>;

type State = {
  dashboard: DashboardDetails;
  dashboardState: DashboardState;
};

class EditDashboard extends React.Component<Props, State> {
  state: State = {
    dashboard: cloneDashboard(EMPTY_DASHBOARD),
    dashboardState: 'create',
  };

  componentDidMount() {
    const {route, router} = this.props;
    router.setRouteLeaveHook(route, this.onRouteLeave);
    window.addEventListener('beforeunload', this.onUnload);
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onUnload);
  }

  setModifiedDashboard = (dashboard: DashboardDetails) => {
    this.setState({
      dashboard,
    });
  };

  onRouteLeave = () => {
    if (this.state.dashboardState === 'create') {
      return UNSAVED_MESSAGE;
    }
    return undefined;
  };

  onUnload = (event: BeforeUnloadEvent) => {
    if (this.state.dashboardState === 'create') {
      event.preventDefault();
      event.returnValue = UNSAVED_MESSAGE;
    }
    return;
  };

  onCommit = () => {
    const {api, organization, location} = this.props;
    const {dashboard} = this.state;

    createDashboard(api, organization.slug, dashboard).then(
      (newDashboard: DashboardDetails) => {
        addSuccessMessage(t('Dashboard created'));
        trackAnalyticsEvent({
          eventKey: 'dashboards2.create.complete',
          eventName: 'Dashboards2: Create complete',
          organization_id: parseInt(organization.id, 10),
        });

        this.setState({
          dashboardState: 'view',
        });

        // redirect to new dashboard
        browserHistory.replace({
          pathname: `/organizations/${organization.slug}/dashboards/${newDashboard.id}/`,
          query: {
            ...location.query,
          },
        });
      }
    );
  };

  onWidgetChange = (widgets: Widget[]) => {
    this.setState((prevState: State) => {
      return {
        ...prevState,
        dashboard: {
          ...prevState.dashboard,
          widgets,
        },
      };
    });
  };

  onCancel = () => {
    const {organization, location} = this.props;
    trackAnalyticsEvent({
      eventKey: 'dashboards2.create.cancel',
      eventName: 'Dashboards2: Create cancel',
      organization_id: parseInt(this.props.organization.id, 10),
    });
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/dashboards/`,
      query: {
        ...location.query,
      },
    });
  };

  onSaveWidget = (widgets: Widget[]) => {
    this.setState((prevState: State) => {
      return {
        ...prevState,
        dashboard: {
          ...prevState.dashboard,
          widgets,
        },
      };
    });
  };

  get isEditing() {
    const {dashboardState} = this.state;
    return dashboardState === 'create';
  }

  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  render() {
    const {organization, router} = this.props;
    const {dashboard} = this.state;
    return (
      <SentryDocumentTitle title={t('Create Dashboard')} orgSlug={organization.slug}>
        <Feature
          organization={organization}
          features={['dashboards-edit']}
          renderDisabled={this.renderNoAccess}
        >
          <LightWeightNoProjectMessage organization={organization}>
            <GlobalSelectionHeader
              skipLoadLastUsed={organization.features.includes('global-views')}
              defaultSelection={{
                datetime: {
                  start: null,
                  end: null,
                  utc: false,
                  period: DEFAULT_STATS_PERIOD,
                },
              }}
            >
              <PageContent>
                <StyledPageHeader>
                  <DashboardTitle
                    dashboard={dashboard}
                    onUpdate={this.setModifiedDashboard}
                    isEditing={this.isEditing}
                  />
                  <Controls
                    organization={organization}
                    dashboard={dashboard}
                    dashboardState="create"
                    onCancel={this.onCancel}
                    onCommit={this.onCommit}
                    dashboards={[]}
                    onEdit={() => {}}
                    onCreate={() => {}}
                    onDelete={() => {}}
                  />
                </StyledPageHeader>
                <Dashboard
                  dashboard={dashboard}
                  paramDashboardId=""
                  organization={organization}
                  isEditing={this.isEditing}
                  onUpdate={this.onWidgetChange}
                  router={router}
                />
              </PageContent>
            </GlobalSelectionHeader>
          </LightWeightNoProjectMessage>
        </Feature>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  height: 40px;
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
  }
`;

export default withApi(withOrganization(EditDashboard));
