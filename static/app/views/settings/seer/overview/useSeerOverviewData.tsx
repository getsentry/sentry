import {useMemo} from 'react';
import uniqBy from 'lodash/uniqBy';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {organizationRepositoriesInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import {organizationIntegrationsQueryOptions} from 'sentry/endpoints/organizations/organizationsIntegrationsQueryOptions';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {useInfiniteQuery, useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useSeerOverviewData() {
  const organization = useOrganization();

  // SCM Data
  const {data: integrationData, isPending: isIntegrationsPending} = useQuery({
    ...organizationIntegrationsQueryOptions({organization}),
    select: data => {
      const allIntegrations = data.json.filter(i => i !== null);
      const scmIntegrations = allIntegrations.filter(integration =>
        integration.provider.features.includes('commits')
      );
      const seerIntegrations = scmIntegrations.filter(integration =>
        isSupportedAutofixProvider({
          id: integration.provider.key,
          name: integration.provider.name,
        })
      );
      return {
        integrations: allIntegrations,
        scmIntegrations,
        seerIntegrations,
      };
    },
  });

  // Repos Data
  const repositoriesResult = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({
      organization,
      query: {per_page: 100},
    }),
    select: ({pages}) => {
      const allRepos = uniqBy(
        pages.flatMap(page => page.json),
        'externalId'
      ).filter(repository => repository.externalId);
      const seerRepos = allRepos.filter(r => isSupportedAutofixProvider(r.provider));
      return {
        allRepos,
        seerRepos,
        reposWithSettings: seerRepos.filter(r => r.settings !== null),
        reposWithCodeReview: seerRepos.filter(r => r.settings?.enabledCodeReview),
      };
    },
  });
  useFetchAllPages({result: repositoriesResult});
  const {data: repositoryData, isPending: isReposPending} = repositoriesResult;

  // Autofix Data
  const autofixSettingsResult = useInfiniteQuery({
    ...bulkAutofixAutomationSettingsInfiniteOptions({organization}),
    select: ({pages}) => {
      const autofixItems = pages.flatMap(page => page.json).filter(s => s !== null);
      return {
        autofixItems,
        projectsWithRepos: autofixItems.filter(settings => settings.reposCount > 0),
        projectsWithAutomation: autofixItems.filter(
          settings => settings.autofixAutomationTuning !== 'off'
        ),
        projectsWithCreatePr: autofixItems.filter(
          settings => settings.automationHandoff?.auto_create_pr
        ),
      };
    },
  });
  useFetchAllPages({result: autofixSettingsResult});
  const {data: autofixData, isPending: isAutofixPending} = autofixSettingsResult;

  const stats = useMemo(() => {
    return {
      // SCM Stats
      integrationCount: integrationData?.integrations.length ?? 0,
      scmIntegrationCount: integrationData?.scmIntegrations.length ?? 0,
      seerIntegrations: integrationData?.seerIntegrations ?? [],
      seerIntegrationCount: integrationData?.seerIntegrations.length ?? 0,

      // Autofix Stats
      totalProjects: autofixData?.autofixItems.length ?? 0,
      projectsWithReposCount: autofixData?.projectsWithRepos.length ?? 0,
      projectsWithAutomationCount: autofixData?.projectsWithAutomation.length ?? 0,
      projectsWithCreatePrCount: autofixData?.projectsWithCreatePr.length ?? 0,

      // Repos Stats
      totalRepoCount: repositoryData?.allRepos.length ?? 0,
      seerRepoCount: repositoryData?.seerRepos.length ?? 0,
      reposWithSettingsCount: repositoryData?.reposWithSettings.length ?? 0,
      reposWithCodeReviewCount: repositoryData?.reposWithCodeReview.length ?? 0,
    };
  }, [integrationData, autofixData, repositoryData]);

  return {
    stats,
    isLoading: isIntegrationsPending || isReposPending || isAutofixPending,
  };
}
