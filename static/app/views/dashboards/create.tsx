import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {EMPTY_DASHBOARD, getDashboardTemplates} from './data';
import DashboardDetail from './detail';
import {DashboardState} from './types';
import {cloneDashboard} from './utils';

export default function CreateDashboard() {
  const organization = useOrganization();
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
  const dashboard = template ? cloneDashboard(template) : cloneDashboard(EMPTY_DASHBOARD);
  const initialState = template ? DashboardState.PREVIEW : DashboardState.CREATE;

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
