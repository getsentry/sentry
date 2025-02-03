import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {switchOrganization} from 'sentry/actionCreators/organizations';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

interface OrganizationLoaderContextProps {
  organizationPromise: Promise<unknown> | null;
}

interface Props {
  children: ReactNode;
}

/**
 * Holds the current organization if loaded.
 */
export const OrganizationContext = createContext<Organization | null>(null);

/**
 * Holds a function to load the organization.
 */
export const OrganizationLoaderContext = createContext<OrganizationLoaderContextProps>({
  organizationPromise: null,
});

/**
 * Ensures that an organization is loaded when the hook is used. This will only
 * be done on first render and if an organization is not already loaded.
 */
export function useEnsureOrganization() {
  const {organizationPromise} = useContext(OrganizationLoaderContext);

  useEffect(() => {
    async function fetchData() {
      await organizationPromise;
    }
    fetchData();
  }, [organizationPromise]);
}

/**
 * Record if the organization was bootstrapped in the last 10 minutes
 */
function setRecentBootstrapTag(orgSlug: string) {
  const previousBootstrapKey = `previous-bootstrap-${orgSlug}`;
  try {
    const previousBootstrapTime = localStorage.getItem(previousBootstrapKey);
    const isRecentBoot = previousBootstrapTime
      ? Date.now() - Number(previousBootstrapTime) < 10 * 60 * 1000
      : false;
    Sentry.setTag('is_recent_boot', isRecentBoot);
    localStorage.setItem(previousBootstrapKey, `${Date.now()}`);
  } catch {
    // Ignore errors
  }
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
  const [organizationPromise, setOrganizationPromise] = useState<Promise<unknown> | null>(
    null
  );

  const lastOrganizationSlug: string | null =
    configStore.lastOrganization ?? organizations[0]?.slug ?? null;
  const params = useParams<{orgId?: string}>();

  // XXX(epurkhiser): When running in deploy preview mode customer domains are
  // not supported correctly. Do NOT use the customer domain from the params.
  const orgSlug = DEPLOY_PREVIEW_CONFIG
    ? lastOrganizationSlug
    : params.orgId || lastOrganizationSlug;

  useEffect(() => {
    // Nothing to do if we already have the organization loaded
    if (organization && organization.slug === orgSlug) {
      return;
    }

    if (!orgSlug) {
      OrganizationStore.setNoOrganization();
      return;
    }

    setRecentBootstrapTag(orgSlug);

    const promise = Sentry.startSpan(
      {
        name: 'ui.bootstrap',
        op: 'ui.render',
        forceTransaction: true,
      },
      // Bootstraps organization, projects, and teams
      () => fetchOrganizationDetails(api, orgSlug, false, true)
    );
    setOrganizationPromise(promise);
  }, [api, orgSlug, organization]);

  // XXX(epurkhiser): User may be null in some scenarios at this point in app
  // boot. We should fix the types here in the future
  const user: User | null = configStore.user;

  // It may be possible for the user to use the sudo modal to load the organization.
  useEffect(() => {
    if (!error) {
      // If the user has an active staff session, the response will not return a
      // 403 but access scopes will be an empty list.
      if (user?.isSuperuser && user?.isStaff && organization?.access?.length === 0) {
        openSudo({
          isSuperuser: true,
          needsReload: true,
          closeEvents: 'none',
          closeButton: false,
        });
      }

      return;
    }

    if (user?.isSuperuser && error.status === 403) {
      openSudo({
        isSuperuser: true,
        needsReload: true,
        closeEvents: 'none',
        closeButton: false,
      });
    }

    // This `catch` can swallow up errors in development (and tests)
    // So let's log them. This may create some noise, especially the test case where
    // we specifically test this branch
    console.error(error); // eslint-disable-line no-console
  }, [user, error, organization]);

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
    <OrganizationLoaderContext.Provider value={{organizationPromise}}>
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    </OrganizationLoaderContext.Provider>
  );
}
