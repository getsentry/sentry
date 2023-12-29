import {Organization} from 'sentry-fixture/organization';
import {Plugin as PluginFixture} from 'sentry-fixture/plugin';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectPluginRow from 'sentry/views/settings/projectPlugins/projectPluginRow';

describe('ProjectPluginRow', function () {
  const plugin = PluginFixture();
  const org = Organization({access: ['project:write']});
  const project = ProjectFixture();
  const params = {orgId: org.slug, projectId: project.slug};
  const routerContext = RouterContextFixture([{organization: org, project}]);

  it('calls `onChange` when clicked', async function () {
    const onChange = jest.fn();

    render(
      <ProjectPluginRow
        params={{}}
        routes={[]}
        {...params}
        {...plugin}
        onChange={onChange}
        project={project}
      />,
      {context: routerContext}
    );

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith('amazon-sqs', true);
  });

  it('can not enable/disable or configure plugin without `project:write`', async function () {
    const onChange = jest.fn();

    render(
      <ProjectPluginRow
        params={{}}
        routes={[]}
        {...params}
        {...plugin}
        onChange={onChange}
        project={project}
      />,
      {
        organization: Organization({access: []}),
      }
    );

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
