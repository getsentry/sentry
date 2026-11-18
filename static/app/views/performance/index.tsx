import {Outlet} from 'react-router';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

function PerformanceContainer() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    <NoProjectMessage organization={organization}>
      <MetricsCardinalityProvider location={location} organization={organization}>
        <MEPSettingProvider>
          <Outlet />
        </MEPSettingProvider>
      </MetricsCardinalityProvider>
    </NoProjectMessage>
  );
}

export default PerformanceContainer;
