import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import LoaderScript from 'sentry/views/settings/project/loaderScript';

function mockApi({
  organization,
  project,
  projectKeys,
}: {
  organization: Organization;
  project: Project;
  projectKeys: ProjectKey[];
}) {
  MockApiClient.clearMockResponses();
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/keys/`,
    method: 'GET',
    body: projectKeys,
  });
}

describe('LoaderScript', function () {
  it('renders error', async function () {
    const {organization, project} = initializeOrg();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      statusCode: 400,
    });

    render(<LoaderScript project={project} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByTestId('loading-error')).toHaveTextContent(
      'Failed to load project keys.'
    );
  });

  it('renders empty', async function () {
    const {organization, project} = initializeOrg();

    mockApi({organization, project, projectKeys: []});

    render(<LoaderScript project={project} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(
      screen.getByText('There are no keys active for this project.')
    ).toBeInTheDocument();
  });

  it('renders for single project', async function () {
    const {organization, project} = initializeOrg();
    const projectKey = ProjectKeysFixture()[0]!;
    const projectKeys = [projectKey];

    mockApi({organization, project, projectKeys});

    render(<LoaderScript project={project} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // Loader Script is rendered
    expect(screen.getByText(`Client Key: ${projectKey.name}`)).toBeInTheDocument();
    const loaderScript = screen.getByRole('textbox', {
      name: 'Loader Script',
    }) as HTMLInputElement;
    const loaderScriptValue = loaderScript.value;
    expect(loaderScriptValue).toEqual(expect.stringContaining(projectKeys[0]!.dsn.cdn));
  });

  it('renders multiple keys', async function () {
    const {organization, project} = initializeOrg();
    const projectKeys = ProjectKeysFixture([
      {
        dsn: {
          secret:
            'http://188ee45a58094d939428d8585aa6f662:a33bf9aba64c4bbdaf873bb9023b6d2c@dev.getsentry.net:8000/1',
          minidump:
            'http://dev.getsentry.net:8000/api/1/minidump?sentry_key=188ee45a58094d939428d8585aa6f662',
          public: 'http://188ee45a58094d939428d8585aa6f662@dev.getsentry.net:8000/1',
          cdn: 'http://dev.getsentry.net:8000/js-sdk-loader/188ee45a58094d939428d8585aa6f662.min.js',
          csp: 'http://dev.getsentry.net:8000/api/1/csp-report/?sentry_key=188ee45a58094d939428d8585aa6f662',
          security:
            'http://dev.getsentry.net:8000/api/1/security-report/?sentry_key=188ee45a58094d939428d8585aa6f662',
          unreal: '',
          crons: '',
        },
        public: '188ee45a58094d939428d8585aa6f662',
        secret: 'a33bf9aba64c4bbdaf873bb9023b6d2c',
        name: 'Key 2',
        rateLimit: null,
        projectId: 1,
        dateCreated: '2018-02-28T07:13:51.087Z',
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
          hasPerformance: false,
          hasReplay: false,
          hasDebug: false,
        },
      },
    ]);

    mockApi({organization, project, projectKeys});

    render(<LoaderScript project={project} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByText(`Client Key: ${projectKeys[0]!.name}`)).toBeInTheDocument();
    expect(screen.getByText(`Client Key: ${projectKeys[1]!.name}`)).toBeInTheDocument();

    const allLoaderScripts = screen.getAllByRole('textbox', {
      name: 'Loader Script',
    }) as HTMLInputElement[];

    expect(allLoaderScripts).toHaveLength(2);
  });

  it('allows to update key settings', async function () {
    const {organization, project} = initializeOrg();
    const baseKey = ProjectKeysFixture()[0]!;
    const projectKey = {
      ...baseKey,
      dynamicSdkLoaderOptions: {
        ...baseKey.dynamicSdkLoaderOptions,
        hasReplay: true,
      },
    };

    mockApi({organization, project, projectKeys: [projectKey]});

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

    render(<LoaderScript project={project} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByText('Enable Performance Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Enable Session Replay')).toBeInTheDocument();
    expect(screen.getByText('Enable Debug Bundles & Logging')).toBeInTheDocument();

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
      name: 'Enable Debug Bundles & Logging',
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

  it('allows to update one of multiple keys', async function () {
    const {organization, project} = initializeOrg();
    const projectKeys = ProjectKeysFixture([
      {
        dsn: {
          secret:
            'http://188ee45a58094d939428d8585aa6f662:a33bf9aba64c4bbdaf873bb9023b6d2c@dev.getsentry.net:8000/1',
          minidump:
            'http://dev.getsentry.net:8000/api/1/minidump?sentry_key=188ee45a58094d939428d8585aa6f662',
          public: 'http://188ee45a58094d939428d8585aa6f662@dev.getsentry.net:8000/1',
          cdn: 'http://dev.getsentry.net:8000/js-sdk-loader/188ee45a58094d939428d8585aa6f662.min.js',
          csp: 'http://dev.getsentry.net:8000/api/1/csp-report/?sentry_key=188ee45a58094d939428d8585aa6f662',
          security:
            'http://dev.getsentry.net:8000/api/1/security-report/?sentry_key=188ee45a58094d939428d8585aa6f662',
          unreal: '',
          crons: '',
        },
        public: '188ee45a58094d939428d8585aa6f662',
        secret: 'a33bf9aba64c4bbdaf873bb9023b6d2c',
        name: 'Key 2',
        rateLimit: null,
        projectId: 1,
        dateCreated: '2018-02-28T07:13:51.087Z',
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
          hasPerformance: false,
          hasReplay: false,
          hasDebug: false,
        },
      },
    ]);
    const projectKey = projectKeys[1];

    mockApi({organization, project, projectKeys});
    const mockPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/${projectKey!.id}/`,
      method: 'PUT',
      body: {
        ...projectKey,
        dynamicSdkLoaderOptions: {
          ...projectKey!.dynamicSdkLoaderOptions,
          hasPerformance: true,
        },
      },
    });

    render(<LoaderScript project={project} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(
      screen.getAllByRole('checkbox', {
        name: 'Enable Performance Monitoring',
        checked: false,
      })
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('checkbox', {
        name: 'Enable Session Replay',
        checked: false,
      })
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('checkbox', {
        name: 'Enable Debug Bundles & Logging',
        checked: false,
      })
    ).toHaveLength(2);

    // Toggle performance option
    await userEvent.click(
      screen.getAllByRole('checkbox', {
        name: 'Enable Performance Monitoring',
      })[1]!
    );

    expect(
      await screen.findByRole('checkbox', {
        name: 'Enable Performance Monitoring',
        checked: true,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable Performance Monitoring',
        checked: false,
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('checkbox', {
        name: 'Enable Session Replay',
        checked: false,
      })
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('checkbox', {
        name: 'Enable Debug Bundles & Logging',
        checked: false,
      })
    ).toHaveLength(2);

    expect(mockPut).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/keys/${projectKey!.id}/`,
      expect.objectContaining({
        data: expect.objectContaining({
          dynamicSdkLoaderOptions: {
            ...projectKey!.dynamicSdkLoaderOptions,
            hasPerformance: true,
          },
        }),
      })
    );
  });
});
