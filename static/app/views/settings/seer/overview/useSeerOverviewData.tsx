import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {useInfiniteQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useSeerOverviewData() {
  const organization = useOrganization();

  // Autofix Data
  const autofixSettingsResult = useInfiniteQuery({
    ...bulkAutofixAutomationSettingsInfiniteOptions({organization}),
    select: ({pages}) => {
      const autofixItems = pages.flatMap(page => page.json).filter(s => s !== null);

      const projectsWithRepos = autofixItems.filter(settings => settings.reposCount > 0);
      const projectsWithAutomation = autofixItems.filter(
        settings => settings.autofixAutomationTuning !== 'off'
      );
      const projectsWithCreatePr = autofixItems.filter(
        settings => settings.automationHandoff?.auto_create_pr
      );

      return {
        autofixItems,
        projectsWithRepos,
        projectsWithAutomation,
        projectsWithCreatePr,
        totalProjects: autofixItems.length ?? 0,
        projectsWithReposCount: projectsWithRepos.length ?? 0,
        projectsWithAutomationCount: projectsWithAutomation.length ?? 0,
        projectsWithCreatePrCount: projectsWithCreatePr.length ?? 0,
      };
    },
  });
  useFetchAllPages({result: autofixSettingsResult});
  return autofixSettingsResult;
}
