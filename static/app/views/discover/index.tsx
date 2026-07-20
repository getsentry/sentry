import {Outlet} from 'react-router-dom';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Redirect} from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

function DiscoverContainer() {
  const organization = useOrganization();
  const location = useLocation();
  const discoverTransactionsDeprecation = getDiscoverDeprecation(organization);
  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/discover/',
    newPathPrefix: discoverTransactionsDeprecation
      ? '/explore/errors/'
      : '/explore/discover/',
  });

  if (redirectPath) {
    // When the deprecation is active and the legacy /discover/ URL carries a
    // transactions dataset, the generic redirect would send the user to
    // /explore/errors/ — which doesn't support transactions. Intercept that
    // case here and send them to /explore/traces/ instead.
    if (
      discoverTransactionsDeprecation &&
      (location.query.queryDataset === SavedQueryDatasets.TRANSACTIONS ||
        location.query.dataset === Dataset.TRANSACTIONS)
    ) {
      return <Redirect to={normalizeUrl('/explore/traces/')} />;
    }
    return <Redirect to={redirectPath} />;
  }

  // Tranasctions deprecation redirects
  if (
    discoverTransactionsDeprecation &&
    location.pathname.includes('/explore/discover/')
  ) {
    // errors dataset (or no dataset specified) redirects to errors url and keeps the same query params
    if (
      location.query.queryDataset !== SavedQueryDatasets.TRANSACTIONS &&
      location.query.dataset !== Dataset.TRANSACTIONS
    ) {
      const match = location.pathname.match(/\/explore\/discover\/([^/]+)\//);
      const discoverPath = match?.[1] ?? 'homepage';
      const targetPath = makeDiscoverPathname({
        path: `/${discoverPath}/`,
        organization,
      });
      return <Redirect to={targetPath + location.search} />;
    }
    // transactions dataset redirects to traces url as we don't support transactions anymore
    return <Redirect to={normalizeUrl('/explore/traces/')} />;
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
