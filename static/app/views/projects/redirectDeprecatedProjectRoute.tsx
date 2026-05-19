import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Redirect} from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';

type RedirectOptions = {
  orgId: string;
  projectId: null | string;
};

type RedirectCallback = (options: RedirectOptions) => string;

export const redirectDeprecatedProjectRoute = (generateRedirectRoute: RedirectCallback) =>
  function RedirectDeprecatedProjectRoute() {
    const params = useParams<{orgId: string; projectId: string}>();
    const location = useLocation();

    // TODO(epurkhiser): The way this function gets called as a side-effect of
    // the render is pretty janky and incorrect... we should fix it.
    function trackRedirect(organizationId: string, nextRoute: string) {
      const payload = {
        feature: 'global_views',
        url: location.pathname, // the URL being redirected from
        organization: organizationId,
      };

      // track redirects of deprecated URLs for analytics
      trackAnalytics('deprecated_urls.redirect', payload);
      return nextRoute;
    }

    const {orgId, projectId: projectSlug} = params;
    const {
      data: project,
      error,
      isPending,
    } = useDetailedProject({orgSlug: orgId, projectSlug});

    const projectId = project?.id ?? null;
    const hasProjectId = typeof projectId === 'string' && projectId.length > 0;
    const organizationId = project?.organization?.id ?? null;

    if (isPending) {
      return (
        <Flex flex={1} padding="2xl">
          <LoadingIndicator />
        </Flex>
      );
    }

    if (!hasProjectId || !organizationId) {
      if (error instanceof RequestError && error.status === 404) {
        return (
          <Flex flex={1} padding="2xl">
            <Alert.Container>
              <Alert variant="danger" showIcon={false}>
                {t('The project you were looking for was not found.')}
              </Alert>
            </Alert.Container>
          </Flex>
        );
      }

      return (
        <Flex flex={1} padding="2xl">
          <LoadingError />
        </Flex>
      );
    }

    return (
      <Flex flex={1} padding="2xl">
        <Redirect
          to={trackRedirect(organizationId, generateRedirectRoute({orgId, projectId}))}
        />
      </Flex>
    );
  };
