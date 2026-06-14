import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {AutofixRepositories} from 'sentry/components/seer/projectDetails/autofixRepositoriesList';
import type {Project} from 'sentry/types/project';

const DEFAULT_PREFERENCE: ProjectSeerPreferences = {
  repositories: [],
  automated_run_stopping_point: 'root_cause',
  automation_handoff: undefined,
};

interface ProjectSeerProps {
  project: Project;
}

export function AutofixRepositoriesLegacy({project}: ProjectSeerProps) {
  const {data, isPending} = useProjectSeerPreferences(project);
  const {preference, code_mapping_repos: codeMappingRepos} = data ?? {};

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <AutofixRepositories
      canWrite
      includeInstructions
      codeMappingRepos={codeMappingRepos}
      preference={preference ?? DEFAULT_PREFERENCE}
      project={project}
    />
  );
}
