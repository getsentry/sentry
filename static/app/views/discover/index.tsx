import {Outlet} from 'react-router-dom';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Redirect} from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {getTransactionsDeprecation} from 'sentry/views/discover/utils';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

function DiscoverContainer() {
  const organization = useOrganization();
  const location = useLocation();
  const discoverTransactionsDeprecation = getTransactionsDeprecation(organization);
  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/discover/',
    newPathPrefix: discoverTransactionsDeprecation
      ? '/explore/errors/'
      : '/explore/discover/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  // Tranasctions deprecation redirects
  if (
    discoverTransactionsDeprecation &&
    location.pathname.includes('/explore/discover/')
  ) {
    // errors dataset redirects to new errors url and keeps the same query params
    if (location.query.dataset === 'errors') {
      const targetPath = makeDiscoverPathname({
        path: '/homepage/',
        organization,
      });
      return <Redirect to={targetPath + location.search} />;
    }
    // transactions dataset redirects to traces url as we don't support transactions anymore
    return <Redirect to="/explore/traces/" />;
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
      overrideName="feature-disabled:discover2-page"
      renderDisabled={renderNoAccess}
    >
      <NoProjectMessage organization={organization}>
        <AnalyticsArea name="discover">
          <Outlet />
        </AnalyticsArea>
      </NoProjectMessage>
    </Feature>
  );
}

export default DiscoverContainer;
