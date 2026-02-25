import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigForm} from 'sentry/views/settings/project/tempest/configForm';

describe('ConfigForm', () => {
  const organization = OrganizationFixture();

  it('renders the Attach Screenshots field with correct label and help text', async () => {
    const project = ProjectFixture({tempestFetchScreenshots: false});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: project,
    });

    render(<ConfigForm organization={organization} project={project} />);

    expect(await screen.findByText('Attach Screenshots')).toBeInTheDocument();
    expect(screen.getByText('Attach screenshots to issues.')).toBeInTheDocument();
  });

  it('renders the switch in the correct initial state when false', async () => {
    const project = ProjectFixture({tempestFetchScreenshots: false});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: project,
    });

    render(<ConfigForm organization={organization} project={project} />);

    const switchInput = await screen.findByRole('checkbox');
    expect(switchInput).not.toBeChecked();
  });

  it('renders the switch in the correct initial state when true', async () => {
    const project = ProjectFixture({tempestFetchScreenshots: true});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: project,
    });

    render(<ConfigForm organization={organization} project={project} />);

    const switchInput = await screen.findByRole('checkbox');
    expect(switchInput).toBeChecked();
  });

  it('calls the API with correct data when toggling the switch', async () => {
    const project = ProjectFixture({tempestFetchScreenshots: false});

    const putMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {...project, tempestFetchScreenshots: true},
    });

    render(<ConfigForm organization={organization} project={project} />);

    const switchInput = await screen.findByRole('checkbox');
    await userEvent.click(switchInput);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {tempestFetchScreenshots: true},
        })
      );
    });
  });

  it('handles undefined tempestFetchScreenshots gracefully', async () => {
    const project = ProjectFixture({tempestFetchScreenshots: undefined});

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: project,
    });

    render(<ConfigForm organization={organization} project={project} />);

    const switchInput = await screen.findByRole('checkbox');
    expect(switchInput).not.toBeChecked();
  });
});
