import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectPluginRow from 'sentry/views/settings/projectPlugins/projectPluginRow';

describe('ProjectPluginRow', function () {
  const plugin = TestStubs.Plugin();
  const org = TestStubs.Organization({access: ['project:write']});
  const project = TestStubs.Project();
  const params = {orgId: org.slug, projectId: project.slug};
  const routerContext = TestStubs.routerContext([{organization: org, project}]);

  it('renders', function () {
    const {container} = render(
      <ProjectPluginRow {...params} {...plugin} project={project} />,
      {
        context: routerContext,
      }
    );

    expect(container).toSnapshot();
  });

  it('calls `onChange` when clicked', function () {
    const onChange = jest.fn();

    render(
      <ProjectPluginRow {...params} {...plugin} onChange={onChange} project={project} />,
      {context: routerContext}
    );

    userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith('amazon-sqs', true);
  });

  it('can not enable/disable or configure plugin without `project:write`', function () {
    const onChange = jest.fn();

    render(
      <ProjectPluginRow {...params} {...plugin} onChange={onChange} project={project} />,
      {
        context: TestStubs.routerContext([
          {organization: TestStubs.Organization({access: []})},
        ]),
      }
    );

    userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
