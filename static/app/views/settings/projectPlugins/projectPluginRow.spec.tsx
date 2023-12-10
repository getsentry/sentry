import {Organization} from 'sentry-fixture/organization';
import RouterContextFixture from 'sentry-fixture/routerContextFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectPluginRow from 'sentry/views/settings/projectPlugins/projectPluginRow';

describe('ProjectPluginRow', function () {
  const plugin = TestStubs.Plugin();
  const org = Organization({access: ['project:write']});
  const project = TestStubs.Project();
  const params = {orgId: org.slug, projectId: project.slug};
  const routerContext = RouterContextFixture([{organization: org, project}]);

  it('renders', function () {
    render(<ProjectPluginRow {...params} {...plugin} project={project} />, {
      context: routerContext,
    });
  });

  it('calls `onChange` when clicked', async function () {
    const onChange = jest.fn();

    render(
      <ProjectPluginRow {...params} {...plugin} onChange={onChange} project={project} />,
      {context: routerContext}
    );

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith('amazon-sqs', true);
  });

  it('can not enable/disable or configure plugin without `project:write`', async function () {
    const onChange = jest.fn();

    render(
      <ProjectPluginRow {...params} {...plugin} onChange={onChange} project={project} />,
      {
        organization: Organization({access: []}),
      }
    );

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
