import {useEffect, useRef} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactChildren;
  location: Location;
  organization: Organization;
};

function PerformanceContainer({organization, children, location}: Props) {
  const prevLocationPathname = useRef('');

  useEffect(
    function () {
      // when new perf page loads, query is pristine
      if (location.pathname !== prevLocationPathname.current) {
        prevLocationPathname.current = location.pathname;
        browserHistory.push({
          pathname: location.pathname,
          query: {
            ...location.query,
            userModified: undefined,
          },
          hash: location.hash,
        });
      }
    },
    [location]
  );

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
      <MEPSettingProvider>{children}</MEPSettingProvider>
    </Feature>
  );
}

export default withOrganization(PerformanceContainer);
