import {Outlet} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function PerformanceContainer() {
  const organization = useOrganization();
  const location = useLocation();

  function renderNoAccess() {
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
      hookName="feature-disabled:performance-page"
      features="performance-view"
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <NoProjectMessage organization={organization}>
        <MetricsCardinalityProvider location={location} organization={organization}>
          <MEPSettingProvider>
            <Outlet />
          </MEPSettingProvider>
        </MetricsCardinalityProvider>
      </NoProjectMessage>
    </Feature>
  );
}

export default PerformanceContainer;
