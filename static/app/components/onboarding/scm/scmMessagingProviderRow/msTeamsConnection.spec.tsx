import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

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

describe('MsTeamsConnection modal', () => {
  const organization = OrganizationFixture();

  it('renders the title, info alert, and marketplace button', () => {
    renderGlobalModal({organization});
    act(() => openMsTeamsConnectionModal(provider));

    expect(
      screen.getByText('Installing Microsoft Teams Integration')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Visit the Teams Marketplace to add Sentry to a team and channel. You'll get a welcome message in the General channel to complete installation."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Teams Marketplace'})).toHaveAttribute(
      'href',
      TEAMS_MARKETPLACE_URL
    );
  });

  it('omits the marketplace button when externalInstall is absent', () => {
    renderGlobalModal({organization});
    act(() => openMsTeamsConnectionModal(providerWithoutExternalInstall));

    expect(
      screen.getByText(
        "Visit the Teams Marketplace to add Sentry to a team and channel. You'll get a welcome message in the General channel to complete installation."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Teams Marketplace'})
    ).not.toBeInTheDocument();
  });
});
