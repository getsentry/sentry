import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import ProjectKeys from 'sentry/views/settings/project/projectKeys/list';

describe('ProjectKeys', () => {
  const {organization, project} = initializeOrg();
  const projectKeys = ProjectKeysFixture();
  let deleteMock: jest.Mock;

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/keys/`,
    },
    route: '/settings/:orgId/projects/:projectId/settings/keys/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: projectKeys,
    });
    deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/${projectKeys[0]!.id}/`,
      method: 'DELETE',
    });
  });

  it('renders empty', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
    render(<ProjectKeys />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByText('There are no keys active for this project.')
    ).toBeInTheDocument();
  });

  it('has clippable box', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    const expandButton = await screen.findByRole('button', {name: 'Expand'});
    await userEvent.click(expandButton);

    expect(expandButton).not.toBeInTheDocument();
  });

  it('renders for default project', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture({platform: 'other'})},
      initialRouterConfig,
    });

    const allDsn = await screen.findAllByRole('textbox', {name: 'DSN URL'});
    expect(allDsn).toHaveLength(1);

    const expandButton = screen.getByRole('button', {name: 'Expand'});
    const dsn = screen.getByRole('textbox', {name: 'DSN URL'});

    expect(expandButton).toBeInTheDocument();
    expect(dsn).toHaveValue(projectKeys[0]!.dsn.public);

    // Verify tabs are present
    expect(screen.getByRole('tab', {name: 'Security Header'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Minidump'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Unreal Engine'})).toBeInTheDocument();

    // Security Header should be visible by default (first tab)
    const securityHeaderEndpoint = screen.getByRole('textbox', {
      name: 'Security Header Endpoint URL',
    });
    expect(securityHeaderEndpoint).toHaveValue(projectKeys[0]!.dsn.security);

    // Click on Minidump tab and verify endpoint
    await userEvent.click(screen.getByRole('tab', {name: 'Minidump'}));
    const minidumpEndpoint = await screen.findByRole('textbox', {
      name: 'Minidump Endpoint URL',
    });
    expect(minidumpEndpoint).toHaveValue(projectKeys[0]!.dsn.minidump);

    // Click on Unreal Engine tab and verify endpoint
    await userEvent.click(screen.getByRole('tab', {name: 'Unreal Engine'}));
    const unrealEndpoint = await screen.findByRole('textbox', {
      name: 'Unreal Engine Endpoint URL',
    });
    // this is empty in the default ProjectKey
    expect(unrealEndpoint).toHaveValue('');
  });

  it('renders for javascript project', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture({platform: 'javascript'})},
      initialRouterConfig,
    });

    const expandButton = screen.queryByRole('button', {name: 'Expand'});
    const dsn = await screen.findByRole('textbox', {name: 'DSN URL'});
    const minidumpEndpoint = screen.queryByRole('textbox', {
      name: 'Minidump Endpoint URL',
    });
    const unrealEndpoint = screen.queryByRole('textbox', {
      name: 'Unreal Engine Endpoint URL',
    });
    const securityHeaderEndpoint = screen.queryByRole('textbox', {
      name: 'Security Header Endpoint URL',
    });

    expect(expandButton).not.toBeInTheDocument();
    expect(dsn).toHaveValue(projectKeys[0]!.dsn.public);
    expect(minidumpEndpoint).not.toBeInTheDocument();
    expect(unrealEndpoint).not.toBeInTheDocument();
    expect(securityHeaderEndpoint).not.toBeInTheDocument();

    // Loader Script inline field is rendered for javascript platform
    const loaderScript = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Loader Script',
    });
    expect(loaderScript).toHaveValue(
      `<script src='${projectKeys[0]!.dsn.cdn}' crossorigin="anonymous"></script>`
    );
  });

  it('renders for javascript-react project', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture({platform: 'javascript-react'})},
      initialRouterConfig,
    });

    const expandButton = screen.queryByRole('button', {name: 'Expand'});
    const dsn = await screen.findByRole('textbox', {name: 'DSN URL'});
    const minidumpEndpoint = screen.queryByRole('textbox', {
      name: 'Minidump Endpoint URL',
    });
    const unrealEndpoint = screen.queryByRole('textbox', {
      name: 'Unreal Engine Endpoint URL',
    });
    const securityHeaderEndpoint = screen.queryByRole('textbox', {
      name: 'Security Header Endpoint URL',
    });

    expect(expandButton).not.toBeInTheDocument();
    expect(dsn).toHaveValue(projectKeys[0]!.dsn.public);
    expect(minidumpEndpoint).not.toBeInTheDocument();
    expect(unrealEndpoint).not.toBeInTheDocument();
    expect(securityHeaderEndpoint).not.toBeInTheDocument();
    // Inline loader script textbox should not be present for non-browser JS platforms
    expect(
      screen.queryByRole('textbox', {name: 'Loader Script'})
    ).not.toBeInTheDocument();
  });

  it('renders multiple keys', async () => {
    const multipleProjectKeys = ProjectKeysFixture([
      {
        dsn: {
          secret:
            'http://188ee45a58094d939428d8585aa6f662:a33bf9aba64c4bbdaf873bb9023b6d2c@dev.getsentry.net:8000/1',
          minidump:
            'http://dev.getsentry.net:8000/api/1/minidump?sentry_key=188ee45a58094d939428d8585aa6f662',
          public: 'http://188ee45a58094d939428d8585aa6f662@dev.getsentry.net:8000/1',
          csp: 'http://dev.getsentry.net:8000/api/1/csp-report/?sentry_key=188ee45a58094d939428d8585aa6f662',
          security:
            'http://dev.getsentry.net:8000/api/1/security-report/?sentry_key=188ee45a58094d939428d8585aa6f662',
          cdn: '',
          unreal: '',
          crons: '',
          playstation:
            'http://dev.getsentry.net:8000/api/1/playstation?sentry_key=188ee45a58094d939428d8585aa6f662',
          integration: 'http://dev.getsentry.net:8000/api/1/integration/',
          otlp_traces: 'http://dev.getsentry.net:8000/api/1/integration/otlp/v1/traces',
          otlp_logs: 'http://dev.getsentry.net:8000/api/1/integration/otlp/v1/logs',
        },
        dateCreated: '2018-02-28T07:13:51.087Z',
        public: '188ee45a58094d939428d8585aa6f662',
        secret: 'a33bf9aba64c4bbdaf873bb9023b6d2c',
        name: 'Key 2',
        rateLimit: null,
        projectId: 1,
        id: '188ee45a58094d939428d8585aa6f662',
        isActive: true,
        label: 'Key 2',
        browserSdkVersion: 'latest',
        browserSdk: {
          choices: [
            ['latest', 'latest'],
            ['7.x', '7.x'],
            ['6.x', '6.x'],
            ['5.x', '5.x'],
            ['4.x', '4.x'],
          ],
        },
        dynamicSdkLoaderOptions: {
          hasDebug: false,
          hasFeedback: false,
          hasPerformance: false,
          hasReplay: false,
          hasLogsAndMetrics: false,
        },
      },
    ]);

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: multipleProjectKeys,
    });

    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture({platform: 'other'})},
      initialRouterConfig,
    });

    const allDsn = await screen.findAllByRole('textbox', {name: 'DSN URL'});
    expect(allDsn).toHaveLength(2);
  });

  it('deletes key', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Delete'}));
    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });

  it('disable and enables key', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    const enableMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/${projectKeys[0]!.id}/`,
      method: 'PUT',
    });

    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Disable'}));
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isActive: false},
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Enable'}));
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {isActive: true},
      })
    );
  });

  it('shows pagination when there are multiple pages', async () => {
    const response = {
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: projectKeys,
      headers: {
        Link:
          `<http://localhost/api/0/projects/${organization.slug}/${project.slug}/keys/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",` +
          `<http://localhost/api/0/projects/${organization.slug}/${project.slug}/keys/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"`,
      },
    };

    MockApiClient.addMockResponse({
      ...response,
      match: [MockApiClient.matchQuery({cursor: undefined})],
    });

    const nextResponse = MockApiClient.addMockResponse({
      ...response,
      match: [MockApiClient.matchQuery({cursor: '2:0:0'})],
    });

    const {router} = render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    const nextButton = await screen.findByRole('button', {name: 'Next'});
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();

    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(router.location.query.cursor).toBe('2:0:0');
    });

    expect(nextResponse).toHaveBeenCalled();
  });

  it('hides pagination when there is none', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    await screen.findByRole('heading', {name: 'Client Keys (DSN)'});
    expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });

  it('shows tabs for Client Keys and Loader Script', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    // Both tabs should be visible
    expect(await screen.findByRole('tab', {name: 'Client Keys'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Loader Script'})).toBeInTheDocument();
  });

  it('defaults to the Client Keys (DSN) tab', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    // Client Keys tab should be selected by default
    expect(
      await screen.findByRole('tab', {name: 'Client Keys', selected: true})
    ).toBeInTheDocument();

    // Loader Script tab should not be selected
    expect(
      screen.getByRole('tab', {name: 'Loader Script', selected: false})
    ).toBeInTheDocument();

    // Client Keys content should be visible (DSN URL field)
    expect(screen.getByRole('textbox', {name: 'DSN URL'})).toBeInTheDocument();
  });

  it('switches to Loader Script tab', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    await screen.findByRole('tab', {name: 'Client Keys'});

    // Switch to Loader Script tab
    await userEvent.click(screen.getByRole('tab', {name: 'Loader Script'}));

    // Loader Script content should be visible
    expect(
      await screen.findByText(/The Loader Script is the easiest way/)
    ).toBeInTheDocument();

    // Key details link should be visible for each key
    expect(screen.getByText('View Key Details')).toBeInTheDocument();
  });

  it('renders loader script settings on Loader Script tab', async () => {
    const projectKey = projectKeys[0]!;

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/${projectKey.id}/`,
      method: 'PUT',
      body: {
        ...projectKey,
        dynamicSdkLoaderOptions: {
          ...projectKey.dynamicSdkLoaderOptions,
          hasPerformance: true,
        },
      },
    });

    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    await screen.findByRole('tab', {name: 'Client Keys'});

    // Switch to Loader Script tab
    await userEvent.click(screen.getByRole('tab', {name: 'Loader Script'}));

    // Should show the key name
    expect(await screen.findByText(`Client Key: ${projectKey.name}`)).toBeInTheDocument();
  });

  it('hides Generate New Key button on Loader Script tab', async () => {
    render(<ProjectKeys />, {
      organization,
      outletContext: {project: ProjectFixture()},
      initialRouterConfig,
    });

    // Generate New Key button should be visible on Client Keys tab
    expect(
      await screen.findByRole('button', {name: 'Generate New Key'})
    ).toBeInTheDocument();

    // Switch to Loader Script tab
    await userEvent.click(screen.getByRole('tab', {name: 'Loader Script'}));

    // Wait for loader script content to appear
    await screen.findByText(/The Loader Script is the easiest way/);

    // Generate New Key button should not be visible
    expect(
      screen.queryByRole('button', {name: 'Generate New Key'})
    ).not.toBeInTheDocument();
  });
});

describe('ProjectKeys - Loader Script tab', () => {
  it('renders loader script error on Loader Script tab', async () => {
    const {organization, project} = initializeOrg();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      statusCode: 400,
    });

    render(<ProjectKeys />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/keys/`,
        },
        route: '/settings/:orgId/projects/:projectId/settings/keys/',
      },
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByTestId('loading-error')).toBeInTheDocument();
  });

  it('renders empty on Loader Script tab', async () => {
    const {organization, project} = initializeOrg();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });

    render(<ProjectKeys />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/keys/`,
        },
        route: '/settings/:orgId/projects/:projectId/settings/keys/',
      },
    });

    await screen.findByRole('tab', {name: 'Client Keys'});

    // Switch to Loader Script tab
    await userEvent.click(screen.getByRole('tab', {name: 'Loader Script'}));

    expect(
      await screen.findByText('There are no keys active for this project.')
    ).toBeInTheDocument();
  });

  it('renders loader items for single project on Loader Script tab', async () => {
    const {organization, project} = initializeOrg();
    const projectKey = ProjectKeysFixture()[0]!;

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [projectKey],
    });

    render(<ProjectKeys />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/keys/`,
        },
        route: '/settings/:orgId/projects/:projectId/settings/keys/',
      },
    });

    await screen.findByRole('tab', {name: 'Client Keys'});

    // Switch to Loader Script tab
    await userEvent.click(screen.getByRole('tab', {name: 'Loader Script'}));

    // Loader Script item is rendered
    expect(await screen.findByText(`Client Key: ${projectKey.name}`)).toBeInTheDocument();

    // Has the Loader Script CDN input in the loader settings
    const loaderScript = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Loader Script',
    });
    expect(loaderScript).toHaveValue(expect.stringContaining(projectKey.dsn.cdn));
  });

  it('allows to update key settings on Loader Script tab', async () => {
    const {organization, project} = initializeOrg();
    const baseKey = ProjectKeysFixture()[0]!;
    const projectKey = {
      ...baseKey,
      dynamicSdkLoaderOptions: {
        ...baseKey.dynamicSdkLoaderOptions,
        hasReplay: true,
      },
    };

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [projectKey],
    });

    const mockPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/${projectKey.id}/`,
      method: 'PUT',
      body: {
        ...projectKey,
        dynamicSdkLoaderOptions: {
          ...projectKey.dynamicSdkLoaderOptions,
          hasPerformance: true,
        },
      },
    });

    render(<ProjectKeys />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/keys/`,
        },
        route: '/settings/:orgId/projects/:projectId/settings/keys/',
      },
    });

    await screen.findByRole('tab', {name: 'Client Keys'});

    // Switch to Loader Script tab
    await userEvent.click(screen.getByRole('tab', {name: 'Loader Script'}));

    expect(await screen.findByText('Enable Performance Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Enable Session Replay')).toBeInTheDocument();
    expect(screen.getByText('Enable SDK debugging')).toBeInTheDocument();

    let performanceCheckbox = screen.getByRole('checkbox', {
      name: 'Enable Performance Monitoring',
    });
    expect(performanceCheckbox).toBeEnabled();
    expect(performanceCheckbox).not.toBeChecked();

    const replayCheckbox = screen.getByRole('checkbox', {
      name: 'Enable Session Replay',
    });
    expect(replayCheckbox).toBeEnabled();
    expect(replayCheckbox).toBeChecked();

    const debugCheckbox = screen.getByRole('checkbox', {
      name: 'Enable SDK debugging',
    });
    expect(debugCheckbox).toBeEnabled();
    expect(debugCheckbox).not.toBeChecked();

    // Toggle performance option
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'Enable Performance Monitoring',
      })
    );

    performanceCheckbox = await screen.findByRole('checkbox', {
      name: 'Enable Performance Monitoring',
      checked: true,
    });
    expect(performanceCheckbox).toBeEnabled();
    expect(performanceCheckbox).toBeChecked();

    expect(mockPut).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/keys/${projectKey.id}/`,
      expect.objectContaining({
        data: expect.objectContaining({
          dynamicSdkLoaderOptions: {
            ...projectKey.dynamicSdkLoaderOptions,
            hasPerformance: true,
          },
        }),
      })
    );
  });
});
