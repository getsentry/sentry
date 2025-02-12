import {createContext, type ReactNode, useEffect, useRef} from 'react';
import * as Sentry from '@sentry/react';

import {switchOrganization} from 'sentry/actionCreators/organizations';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {
  useBootstrapOrganizationQuery,
  useBootstrapProjectsQuery,
  useBootstrapTeamsQuery,
} from 'sentry/bootstrap/bootstrapRequests';
import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useParams} from 'sentry/utils/useParams';

interface OrganizationLoaderContextProps {
  bootstrapIsPending: boolean;
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
  bootstrapIsPending: false,
});

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
 */
export function OrganizationContextProvider({children}: Props) {
  const configStore = useLegacyStore(ConfigStore);

  const {organizations} = useLegacyStore(OrganizationsStore);
  const {organization, error} = useLegacyStore(OrganizationStore);
  const lastOrganizationSlug: string | null =
    configStore.lastOrganization ?? organizations[0]?.slug ?? null;
  const params = useParams<{orgId?: string}>();
  const spanRef = useRef<Sentry.Span | null>(null);

  // XXX(epurkhiser): When running in deploy preview mode customer domains are
  // not supported correctly. Do NOT use the customer domain from the params.
  const orgSlug = DEPLOY_PREVIEW_CONFIG
    ? lastOrganizationSlug
    : params.orgId || lastOrganizationSlug;

  const {isFetching: isOrganizationFetching} = useBootstrapOrganizationQuery(orgSlug);
  const {isFetching: isTeamsFetching} = useBootstrapTeamsQuery(orgSlug);
  const {isFetching: isProjectsFetching} = useBootstrapProjectsQuery(orgSlug);
  const bootstrapIsPending =
    isOrganizationFetching || isTeamsFetching || isProjectsFetching;

  useEffect(() => {
    // Clear stores when the org slug changes
    if (organization?.slug && organization?.slug !== orgSlug) {
      OrganizationStore.reset();
      ProjectsStore.reset();
      TeamStore.reset();
      PageFiltersStore.onReset();
    }
  }, [orgSlug, organization?.slug]);

  useEffect(() => {
    if (!orgSlug) {
      OrganizationStore.setNoOrganization();
      return;
    }

    if (bootstrapIsPending && !spanRef.current) {
      // Measure the time it takes to bootstrap all three requests
      setRecentBootstrapTag(orgSlug);
      spanRef.current = Sentry.startInactiveSpan({
        name: 'ui.bootstrap',
        op: 'ui.render',
        forceTransaction: true,
      });
    }

    if (!bootstrapIsPending && spanRef.current) {
      spanRef.current.end();
      spanRef.current = null;
    }
  }, [bootstrapIsPending, orgSlug]);

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
    <OrganizationLoaderContext.Provider value={{bootstrapIsPending}}>
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    </OrganizationLoaderContext.Provider>
  );
}
