import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {EMPTY_DASHBOARD, getDashboardTemplates} from './data';
import DashboardDetail from './detail';
import {assignDefaultLayout, assignTempId, getInitialColumnDepths} from './layoutUtils';
import type {Widget} from './types';
import {DashboardState, DEFAULT_WIDGET_NAME, MAX_WIDGETS} from './types';
import {cloneDashboard} from './utils';

export default function CreateDashboard() {
  const organization = useOrganization();
  const location = useLocation();
  const {templateId} = useParams<{templateId: string}>();

  function renderDisabled() {
    return (
      <Layout.Page withPadding>
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Layout.Page>
    );
  }

  const template = templateId
    ? getDashboardTemplates(organization).find(
        dashboardTemplate => dashboardTemplate.id === templateId
      )
    : undefined;

  let dashboard = template ? cloneDashboard(template) : cloneDashboard(EMPTY_DASHBOARD);
  const initialState = template ? DashboardState.PREVIEW : DashboardState.CREATE;

  // Check for widgets passed via location state (i.e. from Add to Dashboard modal)
  const widgetsFromState = (location.state as {widgets?: Widget[]})?.widgets;
  if (widgetsFromState && widgetsFromState.length > 0) {
    // Validate widget count doesn't exceed maximum
    const widgetsToAdd =
      widgetsFromState.length > MAX_WIDGETS
        ? widgetsFromState.slice(0, MAX_WIDGETS)
        : widgetsFromState;

    // Apply default titles and temp IDs to widgets
    const processedWidgets = widgetsToAdd.map((widget: Widget) =>
      assignTempId({
        ...widget,
        title: widget.title || DEFAULT_WIDGET_NAME,
      })
    );

    // Append widgets to dashboard and assign layouts
    dashboard = {
      ...dashboard,
      widgets: assignDefaultLayout(
        [...dashboard.widgets, ...processedWidgets],
        getInitialColumnDepths()
      ),
    };
  }

  return (
    <Feature
      features="dashboards-edit"
      organization={organization}
      renderDisabled={renderDisabled}
    >
      <ErrorBoundary>
        <DashboardDetail
          initialState={initialState}
          dashboard={dashboard}
          dashboards={[]}
        />
      </ErrorBoundary>
    </Feature>
  );
}
