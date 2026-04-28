import {Outlet} from 'react-router-dom';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

function PerformanceContainer() {
  const organization = useOrganization();
  const location = useLocation();

  function renderNoAccess() {
    return (
      <Stack flex={1} padding="2xl 3xl">
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Stack>
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
