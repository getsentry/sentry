import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactNode;
  location: Location;
  organization: Organization;
};

const queryClient = new QueryClient();

function PerformanceContainer({organization, location, children}: Props) {
  function renderNoAccess() {
    return (
      <Layout.Page withPadding>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
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
        <QueryClientProvider client={queryClient}>
          <MetricsCardinalityProvider location={location} organization={organization}>
            <MEPSettingProvider>{children}</MEPSettingProvider>
          </MetricsCardinalityProvider>
        </QueryClientProvider>
      </NoProjectMessage>
    </Feature>
  );
}

export default withOrganization(PerformanceContainer);
