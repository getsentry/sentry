import {useLayoutEffect} from 'react';
import * as Sentry from '@sentry/react';

import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useLastKnownRoute} from 'sentry/views/lastKnownRouteContextProvider';
import OrganizationLayout from 'sentry/views/organizationLayout';

type Props = RouteComponentProps;

function RouteNotFound({location}: Props) {
  const navigate = useNavigate();
  const {pathname, search, hash} = location;
  const lastKnownRoute = useLastKnownRoute();
  const isMissingSlash = pathname[pathname.length - 1] !== '/';

  useLayoutEffect(() => {
    // Attempt to fix trailing slashes first
    if (isMissingSlash) {
      navigate(`${pathname}/${search}${hash}`, {replace: true});
      return;
    }

    Sentry.withScope(scope => {
      scope.setFingerprint(['RouteNotFound']);
      scope.setTag('isMissingSlash', isMissingSlash);
      scope.setTag('pathname', pathname);
      scope.setTag('lastKnownRoute', lastKnownRoute);
      Sentry.captureException(new Error('Route not found'));
    });
  }, [pathname, search, hash, isMissingSlash, lastKnownRoute, navigate]);

  if (isMissingSlash) {
    return null;
  }

  return (
    <SentryDocumentTitle title={t('Page Not Found')}>
      <OrganizationLayout>
        <Layout.Page withPadding>
          <NotFound />
        </Layout.Page>
      </OrganizationLayout>
    </SentryDocumentTitle>
  );
}

export default RouteNotFound;
