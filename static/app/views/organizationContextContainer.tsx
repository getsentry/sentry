import {Component, Fragment, useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {Alert} from 'sentry/components/alert';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingError from 'sentry/components/loadingError';
import LoadingTriangle from 'sentry/components/loadingTriangle';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Sidebar from 'sentry/components/sidebar';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import {t} from 'sentry/locale';
import SentryTypes from 'sentry/sentryTypes';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';

import {OrganizationContext} from './organizationContext';

const OrganizationHeader = HookOrDefault({
  hookName: 'component:organization-header',
});

interface OrganizationContextContainerProps {
  /**
   * Render the sidebar when possible.
   */
  includeSidebar: boolean;
  /**
   * If no organization is available from any contexts, try using the
   * lastOrganization from the ConfigStore.
   */
  useLastOrganization: boolean;
  children?: React.ReactNode;
}

/**
 * There are still a number of places where we consume the lgacy organization
 * context. So for now we still need a component that provides this.
 */
class LegacyOrganizationContextProvider extends Component<{value: Organization | null}> {
  static childContextTypes = {
    organization: SentryTypes.Organization,
  };

  getChildContext() {
    return {organization: this.props.value};
  }

  render() {
    return this.props.children;
  }
}

/**
 * Responsible for a number of organization related things:
 *
 * - Will load the current organization into the OrganizationStore if not
 *   already present. This will often already be loaded by the
 *   `preload-data.html` template
 *
 * -
 */
function OrganizationContextContainer({
  includeSidebar,
  useLastOrganization,
  children,
}: OrganizationContextContainerProps) {
  const api = useApi();
  const configStore = useLegacyStore(ConfigStore);

  const {organizations} = useLegacyStore(OrganizationsStore);
  const {organization, loading, error, errorType} = useLegacyStore(OrganizationStore);

  const hasMadeFirstFetch = useRef(false);

  const lastOrganization = useLastOrganization
    ? configStore.lastOrganization ?? organizations[0]?.slug
    : null;

  const routes = useRoutes();
  const params = useParams<{orgId?: string}>();

  // Detect org slug from the params, lastOrganization, or just use the first
  // organizaton in the list
  const orgSlug = params.orgId || lastOrganization;

  const handleLoad = useCallback(() => {
    if (!orgSlug) {
      return;
    }

    metric.mark({name: 'organization-details-fetch-start'});
    fetchOrganizationDetails(api, orgSlug, false, hasMadeFirstFetch.current);
    hasMadeFirstFetch.current = true;
  }, [api, orgSlug]);

  // If the organization slug differs from what we have in the organization
  // store reload the store
  useEffect(() => {
    // Nothing to do if we already have the organization loaded
    if (organization && organization.slug === orgSlug) {
      return;
    }

    handleLoad();
  }, [orgSlug, organization, handleLoad]);

  // Take a measurement for when organization details are done loading and the
  // new state is applied
  useEffect(
    () => {
      if (organization === null) {
        return;
      }

      metric.measure({
        name: 'app.component.perf',
        start: 'organization-details-fetch-start',
        data: {
          name: 'org-details',
          route: getRouteStringFromRoutes(routes),
          organization_id: parseInt(organization.id, 10),
        },
      });
    },
    // Ignore the `routes` dependency for the metrics measurement
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organization]
  );

  // Configure sentry SDK scope to have organization tag
  useEffect(() => {
    if (organization === null || error) {
      return;
    }

    Sentry.configureScope(scope => {
      // XXX(dcramer): this is duplicated in sdk.py on the backend
      scope.setTag('organization', organization.id);
      scope.setTag('organization.slug', organization.slug);
      scope.setContext('organization', {id: organization.id, slug: organization.slug});
    });
  }, [organization, error]);

  const {user} = configStore;

  // If we've had an error it may be possible for the user to use the sudo
  // modal to load the organization.
  useEffect(() => {
    if (!error) {
      return;
    }

    if (user.isSuperuser && error.status === 403) {
      openSudo({isSuperuser: true, needsReload: true});
    }

    // This `catch` can swallow up errors in development (and tests)
    // So let's log them. This may create some noise, especially the test case where
    // we specifically test this branch
    console.error(error); // eslint-disable-line no-console
  }, [user, error]);

  if (loading) {
    return <LoadingTriangle>{t('Loading data for your organization.')}</LoadingTriangle>;
  }

  const sidebar = includeSidebar ? (
    <Sidebar organization={organization ?? undefined} />
  ) : null;

  const mainBody = (
    <SentryDocumentTitle noSuffix title={organization?.name ?? 'Sentry'}>
      <LegacyOrganizationContextProvider value={organization}>
        <OrganizationContext.Provider value={organization}>
          <div className="app">
            {organization && <OrganizationHeader organization={organization} />}
            {sidebar}
            {children}
          </div>
        </OrganizationContext.Provider>
      </LegacyOrganizationContextProvider>
    </SentryDocumentTitle>
  );

  if (error) {
    const errorBody =
      errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS ? (
        // We can still render when an org can't be loaded due to 401. The
        // backend will handle redirects when this is a problem.
        mainBody
      ) : errorType === ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND ? (
        <Alert type="error" data-test-id="org-loading-error">
          {t('The organization you were looking for was not found.')}
        </Alert>
      ) : (
        <LoadingError onRetry={handleLoad} />
      );

    return (
      <Fragment>
        {sidebar}
        <ErrorWrapper>{errorBody}</ErrorWrapper>
      </Fragment>
    );
  }

  return mainBody;
}

const ErrorWrapper = styled('div')`
  padding: ${space(3)};
`;

export default OrganizationContextContainer;
