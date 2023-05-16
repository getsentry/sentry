import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';

const ERROR_NAME = 'Permission Denied';

function PermissionDenied() {
  const routes = useRoutes();
  useEffect(() => {
    const route = getRouteStringFromRoutes(routes);
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `${ERROR_NAME}${route ? ` : ${route}` : ''}`,
      level: 'error',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SentryDocumentTitle title={t('Permission Denied')}>
      <Layout.Page withPadding>
        <LoadingError
          message={tct(
            `Your role does not have the necessary permissions to access this
             resource, please read more about [link:organizational roles]`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/accounts/membership/" />
              ),
            }
          )}
        />
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default PermissionDenied;
