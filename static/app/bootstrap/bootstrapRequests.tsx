import {useLayoutEffect} from 'react';
import * as Sentry from '@sentry/react';

import {setActiveOrganization} from 'sentry/actionCreators/organizations';
import {
  getBoostrapTeamsQueryOptions,
  getBootstrapOrganizationQueryOptions,
  getBootstrapProjectsQueryOptions,
} from 'sentry/bootstrap/bootstrapRequestOptions';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import FeatureFlagOverrides from 'sentry/utils/featureFlagOverrides';
import {
  addOrganizationFeaturesHandler,
  buildSentryFeaturesHandler,
} from 'sentry/utils/featureFlags';
import {useQuery} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';

export function useBootstrapOrganizationQuery(orgSlug: string | null) {
  const options = getBootstrapOrganizationQueryOptions(orgSlug);
  const organizationQuery = useQuery(options);

  useLayoutEffect(() => {
    if (organizationQuery.data) {
      // Shallow copy to avoid mutating the original object
      const organization = {...organizationQuery.data};

      // FeatureFlagOverrides mutates the organization object
      FeatureFlagOverrides.singleton().loadOrg(organization);
      addOrganizationFeaturesHandler({
        organization,
        handler: buildSentryFeaturesHandler('feature.organizations:'),
      });

      OrganizationStore.onUpdate(organization, {replace: true});
      setActiveOrganization(organization);

      const scope = Sentry.getCurrentScope();
      scope.setTag('organization', organization.id);
      scope.setTag('organization.slug', organization.slug);
      scope.setContext('organization', {
        id: organization.id,
        slug: organization.slug,
      });
    }
    if (organizationQuery.error) {
      if (
        organizationQuery.error instanceof RequestError &&
        // By default, `react-query` will refetch stale queries on window focus.
        // This can lead to many queries that hit Sentry's API rate limit. In the case
        // of the organization details endpoint, an error means that the OrganizationStore
        // will not have an organization, which leads to `useOrganization` throwning because
        // organization is undefined. This ultimately leads to a "crash" for the user
        // (e.g. blank page w/ an error message).
        !(
          organizationQuery.error.status === 429 &&
          orgSlug === OrganizationStore.state.organization?.slug
        )
      ) {
        OrganizationStore.onFetchOrgError(organizationQuery.error as any);
      }
    }
  }, [organizationQuery.data, organizationQuery.error, orgSlug]);

  return organizationQuery;
}

export function useBootstrapTeamsQuery(orgSlug: string | null) {
  const teamsQuery = useQuery(getBoostrapTeamsQueryOptions(orgSlug));

  useLayoutEffect(() => {
    if (teamsQuery.data) {
      TeamStore.loadInitialData(
        teamsQuery.data.teams,
        teamsQuery.data.hasMore,
        teamsQuery.data.cursor
      );
    }
  }, [teamsQuery.data]);

  return teamsQuery;
}

export function useBootstrapProjectsQuery(orgSlug: string | null) {
  const projectsQuery = useQuery(getBootstrapProjectsQueryOptions(orgSlug));

  useLayoutEffect(() => {
    if (projectsQuery.data) {
      ProjectsStore.loadInitialData(projectsQuery.data);
    }
  }, [projectsQuery.data]);

  return projectsQuery;
}
