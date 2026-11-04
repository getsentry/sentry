import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {ConnectScmBlock} from './connectScmBlock';

// Render every repo option in JSDOM, which has no layout for the virtualizer to measure.
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: i * 36,
        size: 36,
      })),
    getTotalSize: () => count * 36,
    measure: jest.fn(),
    measureElement: jest.fn(),
    scrollToIndex: jest.fn(),
  })),
}));

describe('ConnectScmBlock', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({slug: 'checkout-api'});

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [GitHubIntegrationProviderFixture()]},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('runs a provider install inside the connect modal and goes back to the picker', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/pipeline/integration_pipeline/`,
      method: 'POST',
      body: {
        step: 'oauth_login',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'github',
        data: {oauthUrl: 'https://github.com/login/oauth/authorize'},
      },
    });

    render(
      <ConnectScmBlock
        data={{reason: 'To read the checkout code behind this KeyError.'}}
        onComplete={jest.fn()}
      />,
      {organization}
    );
    renderGlobalModal({organization});

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Connect your code'}));

    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent('To read the checkout code behind this KeyError.');
    expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();

    await userEvent.click(await screen.findByRole('button', {name: 'Add GitHub'}));
    expect(await screen.findByText('Installing GitHub Integration')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(screen.queryByText('Installing GitHub Integration')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add GitHub'})).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('links the chosen repository to the projects Seer picked', async () => {
    const integration = OrganizationIntegrationsFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [integration],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      body: {
        repos: [
          {
            externalId: '5',
            identifier: 'getsentry/checkout',
            name: 'checkout',
            isInstalled: true,
          },
        ],
      },
    });
    const repository = RepositoryFixture({
      id: '42',
      externalId: '5',
      name: 'getsentry/checkout',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [repository],
    });
    const linkRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/repo/`,
      method: 'POST',
      body: {},
    });
    const onComplete = jest.fn();

    render(
      <ConnectScmBlock
        data={{
          reason: 'To read the checkout code.',
          project_slugs: [project.slug, 'not-a-project'],
        }}
        onComplete={onComplete}
      />,
      {organization}
    );
    renderGlobalModal({organization});
    await userEvent.click(screen.getByRole('button', {name: 'Connect your code'}));

    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent('Link a repository to');
    expect(modal).toHaveTextContent('checkout-api');
    expect(modal).not.toHaveTextContent('not-a-project');

    await userEvent.click(await screen.findByRole('textbox'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'checkout'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Link and continue'}));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(linkRequest).toHaveBeenCalledTimes(1);
    expect(linkRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/repo/`,
      expect.objectContaining({data: {repositoryId: '42'}})
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        linked_projects: ['checkout-api'],
        repo_name: 'getsentry/checkout',
      })
    );
  });
});
