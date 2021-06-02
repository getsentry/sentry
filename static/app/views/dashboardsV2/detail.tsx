import {cloneElement, Component, isValidElement} from 'react';
import {browserHistory, PlainRoute, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {
  createDashboard,
  deleteDashboard,
  updateDashboard,
} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Breadcrumbs from 'app/components/breadcrumbs';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Banner from './banner';
import Controls from './controls';
import Dashboard from './dashboard';
import {DEFAULT_STATS_PERIOD, EMPTY_DASHBOARD} from './data';
import DashboardTitle from './title';
import {DashboardDetails, DashboardListItem, DashboardState, Widget} from './types';
import {cloneDashboard, isBannerHidden, setBannerHidden} from './utils';

const UNSAVED_MESSAGE = t('You have unsaved changes, are you sure you want to leave?');

type RouteParams = {
  orgId: string;
  dashboardId?: string;
  widgetId?: number;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  api: Client;
  organization: Organization;
  initialState: DashboardState;
  dashboard: DashboardDetails;
  dashboards: DashboardListItem[];
  route: PlainRoute;
  reloadData?: () => void;
};

type State = {
  dashboardState: DashboardState;
  modifiedDashboard: DashboardDetails | null;
  widgetToBeUpdated?: Widget;
  isBannerHidden: boolean;
};

class DashboardDetail extends Component<Props, State> {
  state: State = {
    dashboardState: this.props.initialState,
    modifiedDashboard: this.updateModifiedDashboard(this.props.initialState),
    isBannerHidden: isBannerHidden(),
  };

  componentDidMount() {
    const {route, router} = this.props;
    this.checkStateRoute();
    router.setRouteLeaveHook(route, this.onRouteLeave);
    window.addEventListener('beforeunload', this.onUnload);
  }

  componentDidUpdate(prevProps: Props) {
    const isHidden = isBannerHidden();
    if (isHidden !== this.state.isBannerHidden) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        isBannerHidden: isHidden,
      });
    }

    if (prevProps.location.pathname !== this.props.location.pathname) {
      this.checkStateRoute();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onUnload);
  }

  handleBannerClick = () => {
    setBannerHidden(true);
    this.setState({isBannerHidden: true});
  };

  checkStateRoute() {
    const {router, organization, params} = this.props;
    const {dashboardId} = params;

    const dashboardDetailsRoute = `/organizations/${organization.slug}/dashboard/${dashboardId}/`;

    if (this.isWidgetBuilderRouter && !this.isEditing) {
      router.replace(dashboardDetailsRoute);
    }

    if (location.pathname === dashboardDetailsRoute && !!this.state.widgetToBeUpdated) {
      this.onSetWidgetToBeUpdated(undefined);
    }
  }

  updateRouteAfterSavingWidget() {
    if (this.isWidgetBuilderRouter) {
      const {router, organization, params} = this.props;
      const {dashboardId} = params;
      if (dashboardId) {
        router.replace(`/organizations/${organization.slug}/dashboard/${dashboardId}/`);
        return;
      }
      router.replace(`/organizations/${organization.slug}/dashboards/new/`);
    }
  }

  updateModifiedDashboard(dashboardState: DashboardState) {
    const {dashboard} = this.props;
    switch (dashboardState) {
      case DashboardState.CREATE:
        return cloneDashboard(EMPTY_DASHBOARD);
      case DashboardState.EDIT:
        return cloneDashboard(dashboard);
      default: {
        return null;
      }
    }
  }

  get isEditing() {
    const {dashboardState} = this.state;
    return [
      DashboardState.EDIT,
      DashboardState.CREATE,
      DashboardState.PENDING_DELETE,
    ].includes(dashboardState);
  }

  get isWidgetBuilderRouter() {
    const {location, params, organization} = this.props;
    const {dashboardId} = params;

    const newWidgetRoutes = [
      `/organizations/${organization.slug}/dashboards/new/widget/new/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/new/`,
    ];

    return newWidgetRoutes.includes(location.pathname) || this.isWidgetBuilderEditRouter;
  }

  get isWidgetBuilderEditRouter() {
    const {location, params, organization} = this.props;
    const {dashboardId, widgetId} = params;

    const widgetEditRoutes = [
      `/organizations/${organization.slug}/dashboards/new/widget/${widgetId}/edit/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/${widgetId}/edit/`,
    ];

    return widgetEditRoutes.includes(location.pathname);
  }

  get dashboardTitle() {
    const {dashboard} = this.props;
    const {modifiedDashboard} = this.state;
    return modifiedDashboard ? modifiedDashboard.title : dashboard.title;
  }

  onEdit = () => {
    const {dashboard} = this.props;

    trackAnalyticsEvent({
      eventKey: 'dashboards2.edit.start',
      eventName: 'Dashboards2: Edit start',
      organization_id: parseInt(this.props.organization.id, 10),
    });

    this.setState({
      dashboardState: DashboardState.EDIT,
      modifiedDashboard: cloneDashboard(dashboard),
    });
  };

  onRouteLeave = () => {
    if (
      ![DashboardState.VIEW, DashboardState.PENDING_DELETE].includes(
        this.state.dashboardState
      )
    ) {
      return UNSAVED_MESSAGE;
    }
    return undefined;
  };

  onUnload = (event: BeforeUnloadEvent) => {
    if (
      [DashboardState.VIEW, DashboardState.PENDING_DELETE].includes(
        this.state.dashboardState
      )
    ) {
      return;
    }
    event.preventDefault();
    event.returnValue = UNSAVED_MESSAGE;
  };

  onCreate = () => {
    const {organization, location} = this.props;
    trackAnalyticsEvent({
      eventKey: 'dashboards2.create.start',
      eventName: 'Dashboards2: Create start',
      organization_id: parseInt(this.props.organization.id, 10),
    });
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/dashboards/new/`,
      query: location.query,
    });
  };

  onDelete = (dashboard: State['modifiedDashboard']) => () => {
    const {api, organization, location} = this.props;
    if (!dashboard?.id) {
      return;
    }

    const previousDashboardState = this.state.dashboardState;

    this.setState({dashboardState: DashboardState.PENDING_DELETE}, () => {
      deleteDashboard(api, organization.slug, dashboard.id)
        .then(() => {
          addSuccessMessage(t('Dashboard deleted'));
          trackAnalyticsEvent({
            eventKey: 'dashboards2.delete',
            eventName: 'Dashboards2: Delete',
            organization_id: parseInt(this.props.organization.id, 10),
          });
          browserHistory.replace({
            pathname: `/organizations/${organization.slug}/dashboards/`,
            query: location.query,
          });
        })
        .catch(() => {
          this.setState({
            dashboardState: previousDashboardState,
          });
        });
    });
  };

  onCancel = () => {
    const {organization, location, params} = this.props;
    if (params.dashboardId) {
      trackAnalyticsEvent({
        eventKey: 'dashboards2.edit.cancel',
        eventName: 'Dashboards2: Edit cancel',
        organization_id: parseInt(this.props.organization.id, 10),
      });
      this.setState({
        dashboardState: DashboardState.VIEW,
        modifiedDashboard: null,
      });
      return;
    }
    trackAnalyticsEvent({
      eventKey: 'dashboards2.create.cancel',
      eventName: 'Dashboards2: Create cancel',
      organization_id: parseInt(this.props.organization.id, 10),
    });
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/dashboards/`,
      query: location.query,
    });
  };

  onCommit = () => {
    const {api, organization, location, dashboard, reloadData} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;

    switch (dashboardState) {
      case DashboardState.CREATE: {
        if (modifiedDashboard) {
          createDashboard(api, organization.slug, modifiedDashboard).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard created'));
              trackAnalyticsEvent({
                eventKey: 'dashboards2.create.complete',
                eventName: 'Dashboards2: Create complete',
                organization_id: parseInt(organization.id, 10),
              });
              this.setState({
                dashboardState: DashboardState.VIEW,
                modifiedDashboard: null,
              });

              // redirect to new dashboard
              browserHistory.replace({
                pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                query: {
                  ...location.query,
                },
              });
            }
          );
        }
        break;
      }
      case DashboardState.EDIT: {
        // only update the dashboard if there are changes
        if (modifiedDashboard) {
          if (isEqual(dashboard, modifiedDashboard)) {
            this.setState({
              dashboardState: DashboardState.VIEW,
              modifiedDashboard: null,
            });
            return;
          }
          updateDashboard(api, organization.slug, modifiedDashboard).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard updated'));
              trackAnalyticsEvent({
                eventKey: 'dashboards2.edit.complete',
                eventName: 'Dashboards2: Edit complete',
                organization_id: parseInt(organization.id, 10),
              });
              this.setState({
                dashboardState: DashboardState.VIEW,
                modifiedDashboard: null,
              });

              if (dashboard && newDashboard.id !== dashboard.id) {
                browserHistory.replace({
                  pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                  query: {
                    ...location.query,
                  },
                });
                return;
              }
              if (reloadData) {
                reloadData();
              }
            }
          );

          return;
        }
        this.setState({
          dashboardState: DashboardState.VIEW,
          modifiedDashboard: null,
        });
        break;
      }
      case DashboardState.VIEW:
      default: {
        this.setState({
          dashboardState: DashboardState.VIEW,
          modifiedDashboard: null,
        });
        break;
      }
    }
  };

  setModifiedDashboard = (dashboard: DashboardDetails) => {
    this.setState({
      modifiedDashboard: dashboard,
    });
  };

  onSetWidgetToBeUpdated = (widget?: Widget) => {
    this.setState({widgetToBeUpdated: widget});
  };

  onUpdateWidget = (widgets: Widget[]) => {
    const {modifiedDashboard} = this.state;

    if (modifiedDashboard === null) {
      return;
    }
    this.setState(
      (state: State) => ({
        ...state,
        widgetToBeUpdated: undefined,
        modifiedDashboard: {
          ...state.modifiedDashboard!,
          widgets,
        },
      }),
      this.updateRouteAfterSavingWidget
    );
  };

  renderWidgetBuilder(dashboard: DashboardDetails) {
    const {children} = this.props;
    const {modifiedDashboard, widgetToBeUpdated} = this.state;

    return isValidElement(children)
      ? cloneElement(children, {
          dashboard: modifiedDashboard ?? dashboard,
          onSave: this.onUpdateWidget,
          widget: widgetToBeUpdated,
        })
      : children;
  }

  renderBanner() {
    const bannerDismissed = this.state.isBannerHidden;

    if (bannerDismissed) {
      return null;
    }

    return <Banner onHideBanner={this.handleBannerClick} />;
  }

  renderDefaultDashboardDetail() {
    const {organization, dashboard, dashboards, params, router, location} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;
    const {dashboardId} = params;

    return (
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
          <LightWeightNoProjectMessage organization={organization}>
            <StyledPageHeader>
              <DashboardTitle
                dashboard={modifiedDashboard ?? dashboard}
                onUpdate={this.setModifiedDashboard}
                isEditing={this.isEditing}
              />
              <Controls
                organization={organization}
                dashboards={dashboards}
                dashboard={dashboard}
                onEdit={this.onEdit}
                onCreate={this.onCreate}
                onCancel={this.onCancel}
                onCommit={this.onCommit}
                onDelete={this.onDelete(dashboard)}
                dashboardState={dashboardState}
              />
            </StyledPageHeader>
            {this.renderBanner()}
            <Dashboard
              paramDashboardId={dashboardId}
              dashboard={modifiedDashboard ?? dashboard}
              organization={organization}
              isEditing={this.isEditing}
              onUpdate={this.onUpdateWidget}
              onSetWidgetToBeUpdated={this.onSetWidgetToBeUpdated}
              router={router}
              location={location}
            />
          </LightWeightNoProjectMessage>
        </PageContent>
      </GlobalSelectionHeader>
    );
  }

  renderDashboardDetail() {
    const {organization, dashboard, dashboards, params, router, location} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;
    const {dashboardId} = params;

    return (
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
        <LightWeightNoProjectMessage organization={organization}>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs
                crumbs={[
                  {
                    label: t('Dashboards'),
                    to: `/organizations/${organization.slug}/dashboards/`,
                  },
                  {
                    label:
                      dashboardState === DashboardState.CREATE
                        ? t('Create Dashboard')
                        : organization.features.includes('dashboards-manage') &&
                          dashboard.id === 'default-overview'
                        ? 'Default Dashboard'
                        : this.dashboardTitle,
                  },
                ]}
              />
              <Layout.Title>
                <DashboardTitle
                  dashboard={modifiedDashboard ?? dashboard}
                  onUpdate={this.setModifiedDashboard}
                  isEditing={this.isEditing}
                />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <Controls
                organization={organization}
                dashboards={dashboards}
                dashboard={dashboard}
                onEdit={this.onEdit}
                onCreate={this.onCreate}
                onCancel={this.onCancel}
                onCommit={this.onCommit}
                onDelete={this.onDelete(dashboard)}
                dashboardState={dashboardState}
              />
            </Layout.HeaderActions>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              <Dashboard
                paramDashboardId={dashboardId}
                dashboard={modifiedDashboard ?? dashboard}
                organization={organization}
                isEditing={this.isEditing}
                onUpdate={this.onUpdateWidget}
                onSetWidgetToBeUpdated={this.onSetWidgetToBeUpdated}
                router={router}
                location={location}
              />
            </Layout.Main>
          </Layout.Body>
        </LightWeightNoProjectMessage>
      </GlobalSelectionHeader>
    );
  }

  render() {
    const {organization, dashboard} = this.props;

    if (this.isEditing && this.isWidgetBuilderRouter) {
      return this.renderWidgetBuilder(dashboard);
    }

    if (
      organization.features.includes('dashboards-manage') &&
      organization.features.includes('dashboards-edit')
    ) {
      return this.renderDashboardDetail();
    }

    return this.renderDefaultDashboardDetail();
  }
}

const StyledPageHeader = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-row-gap: ${space(2)};
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: minmax(0, 1fr) max-content;
    grid-column-gap: ${space(2)};
    height: 40px;
  }
`;

export default withApi(withOrganization(DashboardDetail));
