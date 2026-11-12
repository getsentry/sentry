import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useProjects} from 'sentry/utils/useProjects';

import {AutofixRepositoriesList} from './autofixRepositoriesList';

export default Storybook.story('AutofixRepositoriesList', story => {
  story('No Instructions', () => {
    const [projectSlug, setProjectSlug] = useQueryState('project', parseAsString);
    const {projects} = useProjects();
    const project = projects.find(p => p.slug === projectSlug);

    return (
      <Stack gap="lg">
        <Storybook.SelectProject
          projectSlug={projectSlug}
          setProjectSlug={setProjectSlug}
        />
        {project ? (
          <AutofixRepositoriesList
            canWrite
            includeInstructions={false}
            project={project}
          />
        ) : (
          <Flex justify="center" padding="xl">
            <Text variant="muted">Select a project to view the story</Text>
          </Flex>
        )}
      </Stack>
    );
  });

  story('With Instructions', () => {
    const [projectSlug, setProjectSlug] = useQueryState('project', parseAsString);
    const {projects} = useProjects();
    const project = projects.find(p => p.slug === projectSlug);

    return (
      <Stack gap="lg">
        <Storybook.SelectProject
          projectSlug={projectSlug}
          setProjectSlug={setProjectSlug}
        />
        {project ? (
          <AutofixRepositoriesList canWrite includeInstructions project={project} />
        ) : (
          <Flex justify="center" padding="xl">
            <Text variant="muted">Select a project to view the story</Text>
          </Flex>
        )}
      </Stack>
    );
  });
});
