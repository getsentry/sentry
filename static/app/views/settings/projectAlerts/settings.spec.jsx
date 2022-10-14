import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import Settings from 'sentry/views/settings/projectAlerts/settings';

describe('ProjectAlertSettings', () => {
  const organization = TestStubs.Organization();
  // 12 minutes
  const digestsMinDelay = 12 * 60;
  // 55 minutes
  const digestsMaxDelay = 55 * 60;
  const project = TestStubs.Project({
    digestsMinDelay,
    digestsMaxDelay,
  });

  beforeEach(() => {
    Client.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    Client.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', () => {
    render(
      <Settings
        canEditRule
        params={{orgId: organization.slug, projectId: project.slug}}
        organization={organization}
        routes={[]}
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
