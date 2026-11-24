import {Outlet} from 'react-router';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useOrganization} from 'sentry/utils/useOrganization';

function PerformanceContainer() {
  const organization = useOrganization();

  return (
    <NoProjectMessage organization={organization}>
      <MEPSettingProvider>
        <Outlet />
      </MEPSettingProvider>
    </NoProjectMessage>
  );
}

export default PerformanceContainer;
