import {DetailedProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectAlertSettings from 'sentry/views/settings/projectAlerts/settings';

describe('ProjectAlertSettings', () => {
  // 12 minutes
  const digestsMinDelay = 12 * 60;
  // 55 minutes
  const digestsMaxDelay = 55 * 60;

  const project = DetailedProjectFixture({
    digestsMinDelay,
    digestsMaxDelay,
  });
  const {organization} = initializeOrg({
    projects: [project],
    router: {
      params: {projectId: project.slug},
    },
  });

  it('renders', async () => {
    render(<ProjectAlertSettings />, {
      outletContext: {project, canEditRule: true},
      organization,
    });

    expect(
      await screen.findByPlaceholderText('e.g. $shortID - $title')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Minimum delivery interval'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Maximum delivery interval'})
    ).toBeInTheDocument();
  });

  it('surfaces the digest min/max error on the maximum delay field', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    const putMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      statusCode: 400,
      body: {
        digestsMinDelay: ['The minimum delay on digests must be lower than the maximum.'],
      },
    });

    render(<ProjectAlertSettings />, {
      outletContext: {project, canEditRule: true},
      organization,
    });

    const maxSlider = await screen.findByRole('slider', {
      name: 'Maximum delivery interval',
    });

    // Drop the maximum below the minimum and commit the change on blur.
    fireEvent.change(maxSlider, {target: {value: '5'}});
    fireEvent.blur(maxSlider);

    await waitFor(() => expect(putMock).toHaveBeenCalled());

    // The API keys the relationship error under digestsMinDelay; it should be
    // re-keyed onto the maximum delivery interval field the user just changed.
    expect(
      await screen.findByText(
        'The minimum delay on digests must be lower than the maximum.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Maximum delivery interval'})
    ).toHaveAttribute('aria-invalid', 'true');
  });
});
