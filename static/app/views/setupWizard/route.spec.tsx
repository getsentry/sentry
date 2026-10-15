import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import SetupWizardRoute from 'sentry/views/setupWizard/route';

const initialRouterConfig = {
  location: {pathname: '/account/settings/wizard/session-hash/'},
  route: '/account/settings/wizard/:wizardHash/',
};

describe('SetupWizardRoute', () => {
  beforeEach(() => {
    ConfigStore.set('localities', [{name: 'us', url: 'https://us.sentry.io'}]);
    MockApiClient.addMockResponse({url: '/organizations/', body: []});
  });

  it('selects a project for a pending CLI session', async () => {
    const organization = OrganizationFixture({access: []});
    const project = ProjectFixture();
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [organization],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project, ProjectFixture({id: '3', slug: 'another-project'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      body: [TeamFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [TeamFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      body: {status: 'pending'},
    });
    const selectProject = MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      method: 'PUT',
      body: {},
    });

    render(<SetupWizardRoute />, {initialRouterConfig});

    expect(await screen.findByText('Select your Sentry project')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'Project'}));
    await userEvent.click(await screen.findByRole('option', {name: project.slug}));
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      body: {status: 'selected'},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() =>
      expect(selectProject).toHaveBeenCalledWith(
        '/wizard/session-hash/session/',
        expect.objectContaining({
          data: {organizationId: organization.id, projectId: project.id},
        })
      )
    );
    expect(await screen.findByText('Waiting for wizard to connect')).toBeInTheDocument();
  });

  it('waits for the CLI when a project is already selected', async () => {
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      body: {status: 'selected'},
    });

    render(<SetupWizardRoute />, {initialRouterConfig});

    expect(await screen.findByText('Waiting for wizard to connect')).toBeInTheDocument();
  });

  describe('session completion', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        await act(async () => {
          await jest.runOnlyPendingTimersAsync();
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('finishes when the CLI has consumed the session', async () => {
      MockApiClient.addMockResponse({
        url: '/wizard/session-hash/session/',
        body: {status: 'selected'},
      });

      const {unmount} = render(<SetupWizardRoute />, {initialRouterConfig});

      expect(
        await screen.findByText('Waiting for wizard to connect')
      ).toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: '/wizard/session-hash/session/',
        body: {status: 'completed'},
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
      });

      expect(
        await screen.findByText('Return to your terminal to complete your setup.')
      ).toBeInTheDocument();
      unmount();
    });

    it('shows a polling failure and retries the session', async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      MockApiClient.addMockResponse({
        url: '/wizard/session-hash/session/',
        body: {status: 'selected'},
      });
      const {unmount} = render(<SetupWizardRoute />, {initialRouterConfig});
      expect(
        await screen.findByText('Waiting for wizard to connect')
      ).toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: '/wizard/session-hash/session/',
        statusCode: 500,
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
      });

      expect(
        await screen.findByText('Failed to load wizard session')
      ).toBeInTheDocument();
      MockApiClient.addMockResponse({
        url: '/wizard/session-hash/session/',
        body: {status: 'completed'},
      });
      await user.click(screen.getByRole('button', {name: 'Retry'}));
      expect(
        await screen.findByText('Return to your terminal to complete your setup.')
      ).toBeInTheDocument();
      unmount();
    });
  });

  it('shows a completed session on arrival', async () => {
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      body: {status: 'completed'},
    });

    render(<SetupWizardRoute />, {initialRouterConfig});

    expect(
      await screen.findByText('Return to your terminal to complete your setup.')
    ).toBeInTheDocument();
  });

  it('shows session request failures', async () => {
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      statusCode: 500,
    });

    render(<SetupWizardRoute />, {initialRouterConfig});

    expect(await screen.findByText('Failed to load wizard session')).toBeInTheDocument();
  });
  it('shows expired sessions', async () => {
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      body: {status: 'expired'},
    });

    render(<SetupWizardRoute />, {initialRouterConfig});

    expect(
      await screen.findByText('This setup session has expired. Run the wizard again.')
    ).toBeInTheDocument();
  });

  it('redirects to the server-provided authentication destination', async () => {
    const redirectUrl =
      '/auth/login/?next=%2Faccount%2Fsettings%2Fwizard%2Fsession-hash%2F';
    const session = MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      body: {status: 'unauthenticated', redirectUrl},
    });

    render(<SetupWizardRoute />, {
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          pathname: '/account/settings/wizard/session-hash/',
          query: {signup: '1', partner: 'partner-slug'},
        },
      },
    });

    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(redirectUrl)
    );
    expect(session).toHaveBeenCalledWith(
      '/wizard/session-hash/session/',
      expect.objectContaining({query: {signup: '1', partner: 'partner-slug'}})
    );
  });

  it('initializes a preselected project', async () => {
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      body: {status: 'pending'},
    });
    const initialize = MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      method: 'POST',
      body: {status: 'selected'},
    });

    render(<SetupWizardRoute />, {
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          pathname: '/account/settings/wizard/session-hash/',
          query: {org_slug: 'org-slug', project_slug: 'project-slug'},
        },
      },
    });

    expect(await screen.findByText('Waiting for wizard to connect')).toBeInTheDocument();
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith(
      '/wizard/session-hash/session/',
      expect.objectContaining({
        data: {organizationSlug: 'org-slug', projectSlug: 'project-slug'},
      })
    );
  });

  it('offers project selection when preselection cannot be resolved', async () => {
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      body: {status: 'pending'},
    });
    MockApiClient.addMockResponse({
      url: '/wizard/session-hash/session/',
      method: 'POST',
      body: {status: 'pending'},
    });

    render(<SetupWizardRoute />, {
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          pathname: '/account/settings/wizard/session-hash/',
          query: {org_slug: 'org-slug', project_slug: 'missing-project'},
        },
      },
    });

    expect(await screen.findByText('Select your Sentry project')).toBeInTheDocument();
  });
});
