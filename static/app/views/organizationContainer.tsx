import {Outlet} from 'react-router';
import {useProfiler} from '@sentry/react';
import {useStore} from 'zustand';
import {useShallow} from 'zustand/react/shallow';

import {Alert} from '@sentry/scraps/alert';
import {Container} from '@sentry/scraps/layout';

import {InitialLoadingIndicator} from 'sentry/components/initialLoadingIndicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {
  ORGANIZATION_FETCH_ERROR_TYPES,
  OrganizationStore,
} from 'sentry/stores/organizationStore';

function OrganizationLoadingIndicator() {
  /* Track how long this component is rendered for. */
  useProfiler('OrganizationLoadingIndicator', {
    hasRenderSpan: true,
  });

  return <InitialLoadingIndicator fallback={<LoadingIndicator />} />;
}

interface Props {
  children: React.JSX.Element;
}

/**
 * Ensures the current organization is loaded. A loading indicator will be
 * rendered while loading the organization.
 */
export function OrganizationContainer({children}: Props) {
  const {loading, error, errorType} = useStore(
    OrganizationStore,
    useShallow(state => ({
      loading: state.loading,
      error: state.error,
      errorType: state.errorType,
    }))
  );

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
    (errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS ||
      errorType === ORGANIZATION_FETCH_ERROR_TYPES.NO_ORGS)
  ) {
    return children;
  }

  if (error) {
    return (
      <Container padding="2xl">
        {errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND ? (
          <Alert.Container>
            <Alert variant="danger" data-test-id="org-loading-error" showIcon={false}>
              {t('The organization you were looking for was not found.')}
            </Alert>
          </Alert.Container>
        ) : (
          <LoadingError />
        )}
      </Container>
    );
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
