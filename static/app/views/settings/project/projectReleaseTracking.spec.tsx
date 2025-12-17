import {PluginsFixture} from 'sentry-fixture/plugins';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectReleaseTracking from 'sentry/views/settings/project/projectReleaseTracking';

describe('ProjectReleaseTracking', () => {
  const {organization: org, project} = initializeOrg();
  const url = `/projects/${org.slug}/${project.slug}/releases/token/`;

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${org.slug}/projects/${project.slug}/settings/release-tracking/`,
    },
    route: '/settings/:orgId/projects/:projectId/settings/release-tracking/',
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: PluginsFixture(),
    });
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: {
        webhookUrl: 'webhook-url',
        token: 'token token token',
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with token', async () => {
    render(<ProjectReleaseTracking />, {
      organization: org,
      outletContext: {project},
      initialRouterConfig,
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('token token token');
    });
  });

  it('can regenerate token', async () => {
    render(<ProjectReleaseTracking />, {
      organization: org,
      outletContext: {project},
      initialRouterConfig,
    });
    renderGlobalModal();

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {
        webhookUrl: 'webhook-url',
        token: 'token2 token2 token2',
      },
    });

    // Click Regenerate Token
    await userEvent.click(await screen.findByRole('button', {name: 'Regenerate Token'}));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('token2 token2 token2');
    });
    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        data: {
          project: project.slug,
        },
      })
    );
  });

  it('renders placeholders on 403', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      status: 403,
      body: undefined,
    });

    render(<ProjectReleaseTracking />, {
      organization: org,
      outletContext: {project},
      initialRouterConfig,
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('YOUR_TOKEN');
    });
  });
});
