import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectKeys from 'sentry/views/settings/project/projectKeys/list';

describe('ProjectKeys', function () {
  const {organization, project} = initializeOrg();
  const projectKeys = ProjectKeysFixture();
  let deleteMock: jest.Mock;

  beforeEach(function () {
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

  it('renders empty', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
    const router = RouterFixture({projectId: project.slug});

    render(<ProjectKeys project={project} />, {router});

    expect(
      await screen.findByText('There are no keys active for this project.')
    ).toBeInTheDocument();
  });

  it('has clippable box', async function () {
    const router = RouterFixture({projectId: project.slug});
    render(<ProjectKeys project={ProjectFixture()} />, {router});

    const expandButton = await screen.findByRole('button', {name: 'Expand'});
    await userEvent.click(expandButton);

    expect(expandButton).not.toBeInTheDocument();
  });

  it('renders for default project', async function () {
    const router = RouterFixture({projectId: project.slug});
    render(<ProjectKeys project={ProjectFixture({platform: 'other'})} />, {router});

    const allDsn = await screen.findAllByRole('textbox', {name: 'DSN URL'});
    expect(allDsn).toHaveLength(1);

    const expandButton = screen.getByRole('button', {name: 'Expand'});
    const dsn = screen.getByRole('textbox', {name: 'DSN URL'});
    const minidumpEndpoint = screen.queryByRole('textbox', {
      name: 'Minidump Endpoint URL',
    });
    const unrealEndpoint = screen.queryByRole('textbox', {
      name: 'Unreal Engine Endpoint URL',
    });
    const securityHeaderEndpoint = screen.queryByRole('textbox', {
      name: 'Security Header Endpoint URL',
    });

    expect(expandButton).toBeInTheDocument();
    expect(dsn).toHaveValue(projectKeys[0]!.dsn.public);
    expect(minidumpEndpoint).toHaveValue(projectKeys[0]!.dsn.minidump);
    // this is empty in the default ProjectKey
    expect(unrealEndpoint).toHaveValue('');
    expect(securityHeaderEndpoint).toHaveValue(projectKeys[0]!.dsn.security);
  });

  it('renders for javascript project', async function () {
    const router = RouterFixture({projectId: project.slug});
    render(<ProjectKeys project={ProjectFixture({platform: 'javascript'})} />, {router});

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

    // Loader Script is rendered
    expect(screen.getByText('Loader Script')).toBeInTheDocument();
    const loaderScript = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Loader Script',
    });
    expect(loaderScript).toHaveValue(
      `<script src='${projectKeys[0]!.dsn.cdn}' crossorigin="anonymous"></script>`
    );
  });

  it('renders for javascript-react project', async function () {
    const router = RouterFixture({projectId: project.slug});
    render(<ProjectKeys project={ProjectFixture({platform: 'javascript-react'})} />, {
      router,
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
    expect(screen.queryByText('Loader Script')).not.toBeInTheDocument();
  });

  it('renders multiple keys', async function () {
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
          hasPerformance: false,
          hasReplay: false,
          hasDebug: false,
        },
      },
    ]);

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: multipleProjectKeys,
    });

    const router = RouterFixture({projectId: project.slug});

    render(<ProjectKeys project={ProjectFixture({platform: 'other'})} />, {router});

    const allDsn = await screen.findAllByRole('textbox', {name: 'DSN URL'});
    expect(allDsn).toHaveLength(2);
  });

  it('deletes key', async function () {
    const router = RouterFixture({projectId: project.slug});
    render(<ProjectKeys project={ProjectFixture()} />, {router});

    await userEvent.click(await screen.findByRole('button', {name: 'Delete'}));
    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });

  it('disable and enables key', async function () {
    const router = RouterFixture({projectId: project.slug});
    render(<ProjectKeys project={ProjectFixture()} />, {router});

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
});
