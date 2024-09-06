import {OrganizationFixture} from 'sentry-fixture/organization';
import {PluginFixture} from 'sentry-fixture/plugin';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectPluginRow from 'sentry/views/settings/projectPlugins/projectPluginRow';

describe('ProjectPluginRow', function () {
  const plugin = PluginFixture();
  const org = OrganizationFixture();
  const project = ProjectFixture();
  const params = {orgId: org.slug, projectId: project.slug};

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
      />
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
        organization: OrganizationFixture({access: []}),
      }
    );

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
