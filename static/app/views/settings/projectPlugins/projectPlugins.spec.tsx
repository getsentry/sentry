import {OrganizationFixture} from 'sentry-fixture/organization';
import {PluginsFixture} from 'sentry-fixture/plugins';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectPlugins from 'sentry/views/settings/projectPlugins/projectPlugins';

describe('ProjectPlugins', () => {
  it('renders', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture();

    render(
      <ProjectPlugins
        organization={organization}
        project={project}
        onChange={jest.fn()}
        loading={false}
        error={undefined}
        plugins={PluginsFixture()}
      />,
      {
        organization,
      }
    );

    await waitFor(() =>
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    );
  });

  it('has error state when plugins=[]', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture();

    render(
      <ProjectPlugins
        organization={organization}
        project={project}
        onChange={jest.fn()}
        loading={false}
        error={new Error('An error')}
        plugins={[]}
      />,
      {
        organization,
      }
    );

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });
});
