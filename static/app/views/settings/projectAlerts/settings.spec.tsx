import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

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
    expect(
      screen.getByText(
        "Oops! Looks like there aren't any available integrations installed."
      )
    ).toBeInTheDocument();
  });
});
