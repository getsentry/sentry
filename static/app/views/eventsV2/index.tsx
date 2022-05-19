import {useEffect, useRef} from 'react';
import {browserHistory} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactChildren;
  location: any;
  organization: Organization;
};

function DiscoverContainer({organization, children, location}: Props) {
  const prevLocationPathname = useRef('');

  useEffect(
    // when new discover page loads, query is pristine
    function () {
      if (location.pathname !== prevLocationPathname.current) {
        prevLocationPathname.current = location.pathname;
        browserHistory.push({
          pathname: location.pathname,
          query: {
            ...location.query,
            userModified: undefined,
          },
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
      features={['discover-basic']}
      organization={organization}
      hookName="feature-disabled:discover2-page"
      renderDisabled={renderNoAccess}
    >
      {children}
    </Feature>
  );
}

export default withOrganization(DiscoverContainer);
