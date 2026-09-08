import {QueryClientProvider} from '@tanstack/react-query';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {openMsTeamsConnectionModal} from './msTeamsConnection';

const TEAMS_MARKETPLACE_URL = 'https://teams.microsoft.com/l/app/test-app-id';

function makeMsteamsProvider(externalInstall?: {
  buttonText: string;
  noticeText: string;
  url: string;
}) {
  const base = GitHubIntegrationProviderFixture({
    key: 'msteams',
    name: 'Microsoft Teams',
    canAdd: false,
  });
  return {
    ...base,
    metadata: {
      ...base.metadata,
      aspects: {...base.metadata.aspects, externalInstall},
    },
  };
}

const provider = makeMsteamsProvider({
  url: TEAMS_MARKETPLACE_URL,
  buttonText: 'Teams Marketplace',
  noticeText: 'Visit the Teams Marketplace to install this integration.',
});
const providerWithoutExternalInstall = makeMsteamsProvider(undefined);

function msteamsIntegration(installationType: string) {
  return OrganizationIntegrationsFixture({
    provider: {
      key: 'msteams',
      slug: 'msteams',
      name: 'Microsoft Teams',
      canAdd: false,
      canDisable: false,
      features: [],
      aspects: {},
    },
    configData: {installationType},
    status: 'active',
    organizationIntegrationStatus: 'active',
  });
}

describe('MsTeamsConnection modal', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: [],
    });
    jest.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  function renderModal() {
    const queryClient = makeTestQueryClient();
    render(<GlobalModal />, {
      organization,
      additionalWrapper: ({children}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    return queryClient;
  }

  it('renders the title, info alert, and marketplace button', async () => {
    renderModal();
    act(() => openMsTeamsConnectionModal(provider, jest.fn()));

    expect(
      screen.getByText('Installing Microsoft Teams Integration')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Visit the Teams Marketplace to add Sentry to a team and channel. You'll get a welcome message in the General channel to complete installation."
      )
    ).toBeInTheDocument();
    const btn = screen.getByRole('button', {name: 'Teams Marketplace'});
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);
    expect(window.open).toHaveBeenCalledWith(
      TEAMS_MARKETPLACE_URL,
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('omits the marketplace button when externalInstall is absent', () => {
    renderModal();
    act(() => openMsTeamsConnectionModal(providerWithoutExternalInstall, jest.fn()));

    expect(
      screen.getByText(
        "Visit the Teams Marketplace to add Sentry to a team and channel. You'll get a welcome message in the General channel to complete installation."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Teams Marketplace'})
    ).not.toBeInTheDocument();
  });

  it('closes and calls onConnected when an eligible workspace appears', async () => {
    const onConnected = jest.fn();
    const queryClient = renderModal();
    act(() => openMsTeamsConnectionModal(provider, onConnected));

    await userEvent.click(screen.getByRole('button', {name: 'Teams Marketplace'}));

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: [msteamsIntegration('born_as_bot')],
    });
    await queryClient.refetchQueries();

    await waitFor(() => {
      expect(
        screen.queryByText('Installing Microsoft Teams Integration')
      ).not.toBeInTheDocument();
    });
    expect(onConnected).toHaveBeenCalledTimes(1);
  });
});
