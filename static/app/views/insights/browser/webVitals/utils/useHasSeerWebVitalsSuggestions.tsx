import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {Project} from 'sentry/types/project';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useProjects from 'sentry/utils/useProjects';

// Checks for:
// - Org has ai features enabled and has given consent
// - Project has a github repository set up
export function useHasSeerWebVitalsSuggestions(selectedProject?: Project) {
  const {
    selection: {projects},
  } = usePageFilters();
  const {projects: allProjects} = useProjects();
  const selectedProjects = getSelectedProjectList(projects, allProjects);
  const project = selectedProject ?? selectedProjects[0]; // By default, use the first selected project if no project is provided

  const {preference, codeMappingRepos} = useProjectSeerPreferences(project!);
  const hasConfiguredRepos = Boolean(
    preference?.repositories?.length || codeMappingRepos?.length
  );
  const hasGithubRepos = Boolean(
    preference?.repositories?.some(repo => repo.provider.includes('github')) ||
    codeMappingRepos?.some(repo => repo.provider.includes('github'))
  );

  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();

  return areAiFeaturesAllowed && hasConfiguredRepos && hasGithubRepos;
}
