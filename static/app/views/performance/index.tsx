import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactChildren;
  location: Location;
  organization: Organization;
};

const queryClient = new QueryClient();

function PerformanceContainer({organization, location, children}: Props) {
  function renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  return (
    <Feature
      hookName="feature-disabled:performance-page"
      features={['performance-view']}
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <QueryClientProvider client={queryClient}>
        <MetricsCardinalityProvider location={location} organization={organization}>
          <MEPSettingProvider>{children}</MEPSettingProvider>
        </MetricsCardinalityProvider>
      </QueryClientProvider>
    </Feature>
  );
}

export default withOrganization(PerformanceContainer);
