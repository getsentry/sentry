import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {useSeerSupportedProviderIds} from 'sentry/components/events/autofix/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {Project} from 'sentry/types/project';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

// Checks for:
// - Org has web vitals suggestions feature enabled
// - Org has ai features enabled and has given consent
// - Project has a supported SCM repository set up (GitHub, GitHub Enterprise, or GitLab with feature flag)
export function useHasSeerWebVitalsSuggestions(selectedProject?: Project) {
  const organization = useOrganization();

  const {
    selection: {projects},
  } = usePageFilters();
  const {projects: allProjects} = useProjects();
  const selectedProjects = getSelectedProjectList(projects, allProjects);
  const project = selectedProject ?? selectedProjects[0]; // By default, use the first selected project if no project is provided

  const {data} = useProjectSeerPreferences(project!);
  const {preference, code_mapping_repos: codeMappingRepos} = data ?? {};
  const hasConfiguredRepos = Boolean(
    preference?.repositories?.length || codeMappingRepos?.length
  );
  const supportedProviderIds = useSeerSupportedProviderIds();
  const hasSupportedRepos = Boolean(
    preference?.repositories?.some(repo =>
      supportedProviderIds.includes(repo.provider)
    ) || codeMappingRepos?.some(repo => supportedProviderIds.includes(repo.provider))
  );

  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();

  return (
    organization.features.includes('performance-web-vitals-seer-suggestions') &&
    areAiFeaturesAllowed &&
    hasConfiguredRepos &&
    hasSupportedRepos
  );
}
