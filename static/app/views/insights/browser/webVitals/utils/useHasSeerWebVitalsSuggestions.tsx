import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

// Checks for:
// - Org has web vitals suggestions feature enabled
// - Org has ai features enabled and has given consent
// - Project has a github repository set up
export function useHasSeerWebVitalsSuggestions() {
  const organization = useOrganization();

  const {
    selection: {projects},
  } = usePageFilters();
  const {projects: allProjects} = useProjects();
  const selectedProjects = getSelectedProjectList(projects, allProjects);
  const project = selectedProjects[0];

  const {preference, codeMappingRepos} = useProjectSeerPreferences(project!);
  const hasConfiguredRepos = Boolean(
    preference?.repositories?.length || codeMappingRepos?.length
  );
  const hasGithubRepos = Boolean(
    preference?.repositories?.some(repo => repo.provider.includes('github')) ||
      codeMappingRepos?.some(repo => repo.provider.includes('github'))
  );

  const {areAiFeaturesAllowed, setupAcknowledgement} = useOrganizationSeerSetup();

  return (
    organization.features.includes('performance-web-vitals-seer-suggestions') &&
    areAiFeaturesAllowed &&
    setupAcknowledgement.orgHasAcknowledged &&
    hasConfiguredRepos &&
    hasGithubRepos
  );
}
