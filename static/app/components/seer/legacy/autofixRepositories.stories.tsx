import {parseAsString, useQueryState} from 'nuqs';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AutofixRepositories} from 'sentry/components/seer/legacy/autofixRepositories';
import * as Storybook from 'sentry/stories';
import {useProjects} from 'sentry/utils/useProjects';

export default Storybook.story('AutofixRepositories (Legacy)', story => {
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
          <AutofixRepositories project={project} />
        ) : (
          <Flex justify="center" padding="xl">
            <Text variant="muted">Select a project to view the story</Text>
          </Flex>
        )}
      </Flex>
    );
  });
});
