import {Outlet} from 'react-router-dom';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Redirect} from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

function DiscoverContainer() {
  const organization = useOrganization();
  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/discover/',
    newPathPrefix: '/explore/discover/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

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
