import {parseAsString, useQueryState} from 'nuqs';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {AutofixRepositories} from 'sentry/components/seer/projectDetails/autofixRepositoriesList';
import * as Storybook from 'sentry/stories';
import type {Project} from 'sentry/types/project';
import {useProjects} from 'sentry/utils/useProjects';

const DEFAULT_PREFERENCE: ProjectSeerPreferences = {
  repositories: [],
  automated_run_stopping_point: 'root_cause',
  automation_handoff: undefined,
};

export default Storybook.story('AutofixRepositoriesList', story => {
  story('Default', () => {
    const [projectSlug, setProjectSlug] = useQueryState('project', parseAsString);
    const {projects} = useProjects();
    const project = projects.find(p => p.slug === projectSlug);

    return (
      <Flex direction="column" gap="lg">
        <Storybook.SelectProject
          projectSlug={projectSlug}
          setProjectSlug={setProjectSlug}
        />
        {project ? (
          <Example project={project} />
        ) : (
          <Flex justify="center" padding="xl">
            <Text variant="muted">Select a project to view the story</Text>
          </Flex>
        )}
      </Flex>
    );
  });
});

function Example({project}: {project: Project}) {
  const {data, isPending} = useProjectSeerPreferences(project);
  const {preference, code_mapping_repos: codeMappingRepos} = data ?? {};

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <AutofixRepositories
      canWrite
      codeMappingRepos={codeMappingRepos}
      preference={preference ?? DEFAULT_PREFERENCE}
      project={project}
    />
  );
}
