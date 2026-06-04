import {useLayoutEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Stack} from '@sentry/scraps/layout';

import {NotFound} from 'sentry/components/errors/notFound';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useLastKnownRoute} from 'sentry/views/lastKnownRouteContextProvider';

export function RouteNotFound() {
  const navigate = useNavigate();
  const {pathname, search, hash} = useLocation();
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
      <Stack flex={1} padding="2xl 3xl">
        <NotFound />
      </Stack>
    </SentryDocumentTitle>
  );
}
