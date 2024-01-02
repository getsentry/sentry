import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Settings from 'sentry/views/settings/projectAlerts/settings';

describe('ProjectAlertSettings', () => {
  const router = RouterFixture();
  const organization = Organization();
  // 12 minutes
  const digestsMinDelay = 12 * 60;
  // 55 minutes
  const digestsMaxDelay = 55 * 60;
  const project = ProjectFixture({
    digestsMinDelay,
    digestsMaxDelay,
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', () => {
    render(
      <Settings
        canEditRule
        params={{projectId: project.slug}}
        organization={organization}
        routes={[]}
        router={router}
        routeParams={router.params}
        route={router.routes[0]}
        location={router.location}
      />
    );

    expect(screen.getByPlaceholderText('e.g. $shortID - $title')).toBeInTheDocument();
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
