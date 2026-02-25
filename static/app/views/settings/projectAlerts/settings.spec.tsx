import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectAlertSettings from 'sentry/views/settings/projectAlerts/settings';

describe('ProjectAlertSettings', () => {
  // 12 minutes
  const digestsMinDelay = 12 * 60;
  // 55 minutes
  const digestsMaxDelay = 55 * 60;

  const project = ProjectFixture({
    digestsMinDelay,
    digestsMaxDelay,
  });
  const {organization} = initializeOrg({
    projects: [project],
    router: {
      params: {projectId: project.slug},
    },
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders all fields with correct labels', async () => {
    render(<ProjectAlertSettings />, {
      outletContext: {project, canEditRule: true},
      organization,
    });

    expect(
      await screen.findByPlaceholderText('e.g. $shortID - $title')
    ).toBeInTheDocument();
    expect(screen.getByText('Subject Template')).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Minimum delivery interval'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', {name: 'Maximum delivery interval'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Oops! Looks like there aren't any available integrations installed."
      )
    ).toBeInTheDocument();
  });

  it('renders range sliders with correct initial numeric values', async () => {
    render(<ProjectAlertSettings />, {
      outletContext: {project, canEditRule: true},
      organization,
    });

    await screen.findByPlaceholderText('e.g. $shortID - $title');

    const minSlider = screen.getByRole('slider', {name: 'Minimum delivery interval'});
    const maxSlider = screen.getByRole('slider', {name: 'Maximum delivery interval'});

    expect(minSlider).toHaveValue(String(digestsMinDelay));
    expect(maxSlider).toHaveValue(String(digestsMaxDelay));
  });

  it('calls the API when subject template input is changed and blurred', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {...project},
    });

    render(<ProjectAlertSettings />, {
      outletContext: {project, canEditRule: true},
      organization,
    });

    const input = await screen.findByPlaceholderText('e.g. $shortID - $title');
    await userEvent.clear(input);
    await userEvent.type(input, 'new subject');
    await userEvent.tab();

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({subjectTemplate: 'new subject'}),
        })
      )
    );
  });
});
