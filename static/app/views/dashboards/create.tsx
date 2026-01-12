import {useEffect, useState} from 'react';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {EMPTY_DASHBOARD, getDashboardTemplates} from './data';
import DashboardDetail from './detail';
import type {DashboardDetails, Widget} from './types';
import {DashboardState} from './types';
import {cloneDashboard} from './utils';

export default function CreateDashboard() {
  const organization = useOrganization();
  const {templateId} = useParams<{templateId: string}>();
  const location = useLocation();
  const navigate = useNavigate();

  const template = templateId
    ? getDashboardTemplates(organization).find(
        dashboardTemplate => dashboardTemplate.id === templateId
      )
    : undefined;

  const baseDashboard = template
    ? cloneDashboard(template)
    : cloneDashboard(EMPTY_DASHBOARD);

  const hasWidgetsToAdd = Object.keys(location.state?.widgets ?? {}).length > 0;

  const [dashboard] = useState<DashboardDetails>(() => {
    if (hasWidgetsToAdd) {
      // Pre-populate dashboard with widgets from location state
      return {
        ...baseDashboard,
        widgets: location.state.widgets as Widget[],
      };
    }
    return baseDashboard;
  });

  // Clear location state after consuming it
  useEffect(() => {
    if (hasWidgetsToAdd) {
      navigate(location.pathname, {replace: true, state: {}});
    }
  }, [hasWidgetsToAdd, navigate, location.pathname]);

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

  return (
    <Feature
      features="dashboards-edit"
      organization={organization}
      renderDisabled={renderDisabled}
    >
      <ErrorBoundary>
        <DashboardDetail
          initialState={template ? DashboardState.PREVIEW : DashboardState.CREATE}
          dashboard={dashboard}
          dashboards={[]}
        />
      </ErrorBoundary>
    </Feature>
  );
}
