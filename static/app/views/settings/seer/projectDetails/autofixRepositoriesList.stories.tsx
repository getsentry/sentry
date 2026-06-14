import * as Storybook from 'sentry/stories';
import {PickProject} from 'sentry/stories/pickProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromSlug} from 'sentry/utils/useProjectFromSlug';
import {AutofixRepositoriesList} from 'sentry/views/settings/seer/projectDetails/autofixRepositoriesList';

export default Storybook.story('AutofixRepositories', story => {
  story('Default', () => {
    function Example({projectSlug}: {projectSlug: string}) {
      const organization = useOrganization();
      const project = useProjectFromSlug({organization, projectSlug});
      return project && <AutofixRepositoriesList canWrite project={project} />;
    }

    return (
      <PickProject multiple={false}>
        {projectSlug => <Example projectSlug={projectSlug} />}
      </PickProject>
    );
  });
});
