import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {switchOrganization} from 'sentry/actionCreators/organizations';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';
import {SentryPropTypeValidators} from 'sentry/sentryPropTypeValidators';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization, User} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';

/**
 * Holds the current organization if loaded.
 */
export const OrganizationContext = createContext<Organization | null>(null);

/**
 * Holds a function to load the organization.
 */
const OrganizationLoaderContext = createContext<null | (() => void)>(null);

interface Props {
  children: React.ReactNode;
}

/**
 * There are still a number of places where we consume the legacy organization
 * context. So for now we still need a component that provides this.
 */
class LegacyOrganizationContextProvider extends Component<{
  value: Organization | null;
  children?: React.ReactNode;
}> {
  static childContextTypes = {
    organization: SentryPropTypeValidators.isOrganization,
  };

  getChildContext() {
    return {organization: this.props.value};
  }

  render() {
    return this.props.children;
  }
}

/**
 * Ensures that an organization is loaded when the hook is used. This will only
 * be done on first render and if an organization is not already loaded.
 */
export function useEnsureOrganization() {
  const loadOrganization = useContext(OrganizationLoaderContext);

  // XXX(epurkhiser): The loadOrganization function is stable as long as the
  // organization slug is stable. A change to the organization slug will cause
  // the organization to be reloaded.
  useEffect(() => loadOrganization?.(), [loadOrganization]);
}

/**
 * Context provider responsible for loading the organization into the
 * OrganizationStore if it is not already present.
 *
 * This provider *does not* immediately attempt to load the organization. A
 * child component must be responsible for calling `useEnsureOrganization` to
 * have the organization loaded.
 */
export function OrganizationContextProvider({children}: Props) {
  const api = useApi();
  const configStore = useLegacyStore(ConfigStore);

  const {organizations} = useLegacyStore(OrganizationsStore);
  const {organization, error} = useLegacyStore(OrganizationStore);

  const lastOrganizationSlug: string | null =
    configStore.lastOrganization ?? organizations[0]?.slug ?? null;

  const routes = useRoutes();
  const params = useParams<{orgId?: string}>();

  // XXX(epurkhiser): When running in deploy preview mode customer domains are
  // not supported correctly. Do NOT use the customer domain from the params.
  const orgSlug = DEPLOY_PREVIEW_CONFIG
    ? lastOrganizationSlug
    : params.orgId || lastOrganizationSlug;

  // Provided to the OrganizationLoaderContext. Loads the organization if it is
  // not already present.
  const loadOrganization = useCallback(() => {
    // Nothing to do if we already have the organization loaded
    if (organization && organization.slug === orgSlug) {
      return;
    }

    if (!orgSlug) {
      return;
    }

    metric.mark({name: 'organization-details-fetch-start'});
    fetchOrganizationDetails(api, orgSlug, false, true);
  }, [api, orgSlug, organization]);

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

  // XXX(epurkhiser): User may be null in some scenarios at this point in app
  // boot. We should fix the types here in the future
  const user: User | null = configStore.user;

  // If we've had an error it may be possible for the user to use the sudo
  // modal to load the organization.
  useEffect(() => {
    if (!error) {
      return;
    }

    if (user?.isSuperuser && error.status === 403) {
      openSudo({isSuperuser: true, needsReload: true});
    }

    // This `catch` can swallow up errors in development (and tests)
    // So let's log them. This may create some noise, especially the test case where
    // we specifically test this branch
    console.error(error); // eslint-disable-line no-console
  }, [user, error]);

  // Switch organizations when the orgId changes
  const lastOrgId = useRef(orgSlug);

  useEffect(() => {
    if (orgSlug && lastOrgId.current !== orgSlug) {
      // Only switch on: org1 -> org2
      // Not on: undefined -> org1
      // Also avoid: org1 -> undefined -> org1
      if (lastOrgId.current) {
        switchOrganization();
      }

      lastOrgId.current = orgSlug;
    }
  }, [orgSlug]);

  return (
    <OrganizationLoaderContext.Provider value={loadOrganization}>
      <OrganizationContext.Provider value={organization}>
        <LegacyOrganizationContextProvider value={organization}>
          {children}
        </LegacyOrganizationContextProvider>
      </OrganizationContext.Provider>
    </OrganizationLoaderContext.Provider>
  );
}
