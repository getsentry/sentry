import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactNode;
  location: Location;
  organization: Organization;
};

function PerformanceContainer({organization, location, children}: Props) {
  function renderNoAccess() {
    return (
      <Layout.Page withPadding>
        <Alert.Container>
          <Alert margin type="warning">
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
          <MEPSettingProvider>{children}</MEPSettingProvider>
        </MetricsCardinalityProvider>
      </NoProjectMessage>
    </Feature>
  );
}

export default withOrganization(PerformanceContainer);
