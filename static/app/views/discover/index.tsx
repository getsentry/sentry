import {Outlet} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

function DiscoverContainer() {
  const organization = useOrganization();
  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/discover/',
    newPathPrefix: '/explore/discover/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

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
      features="discover-basic"
      organization={organization}
      hookName="feature-disabled:discover2-page"
      renderDisabled={renderNoAccess}
    >
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </Feature>
  );
}

export default DiscoverContainer;
