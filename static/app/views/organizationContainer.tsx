import {useCallback} from 'react';
import {Outlet} from 'react-router-dom';
import {useProfiler} from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {Container} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {getSplashLoader} from 'sentry/utils/splashLoader';

function OrganizationLoadingIndicator() {
  /* Track how long this component is rendered for. */
  useProfiler('OrganizationLoadingIndicator', {
    hasRenderSpan: true,
  });

  /**
   * Re-parent the server-rendered loader instead of rendering our own, so there
   * is no layout shift on boot. `appendChild` moves the same node, so an org
   * switch (store resets to loading) re-mounts and picks it back up.
   */
  const loaderRef = useCallback((node: HTMLDivElement | null) => {
    const loader = getSplashLoader();
    if (node && loader) {
      node.appendChild(loader);
    }
  }, []);

  return <div ref={loaderRef} />;
}

interface Props {
  children: React.JSX.Element;
}

/**
 * Ensures the current organization is loaded. A loading indicator will be
 * rendered while loading the organization.
 */
export function OrganizationContainer({children}: Props) {
  const {loading, error, errorType} = useLegacyStore(OrganizationStore);

  if (loading) {
    return <OrganizationLoadingIndicator />;
  }

  // XXX(epurkhiser): There is a special case scenarion when we're unable to
  // load an organization due to access issues. Right now this is VERY SPECIFIC
  // to being able to enable 2FA, or a user not being a member of any org.
  //
  // In this scenario we render the children **explicitly without an
  // organization in context**.
  //
  // TODO(epurkhiser): This scenario desprately should be improved
  if (
    error &&
    errorType &&
    [
      ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS,
      ORGANIZATION_FETCH_ERROR_TYPES.NO_ORGS,
    ].includes(errorType)
  ) {
    return children;
  }

  if (error) {
    const errorBody =
      errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS ? (
        <Alert.Container>
          <Alert variant="danger" data-test-id="org-access-error" showIcon={false}>
            {t('You do not have access to this organization.')}
          </Alert>
        </Alert.Container>
      ) : errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND ? (
        <Alert.Container>
          <Alert variant="danger" data-test-id="org-loading-error" showIcon={false}>
            {t('The organization you were looking for was not found.')}
          </Alert>
        </Alert.Container>
      ) : (
        <LoadingError />
      );

    return <Container padding="2xl">{errorBody}</Container>;
  }

  return children;
}

/**
 * Route component version of OrganizationContainer that uses <Outlet />.
 */
export function OrganizationContainerRoute() {
  return (
    <OrganizationContainer>
      <Outlet />
    </OrganizationContainer>
  );
}
