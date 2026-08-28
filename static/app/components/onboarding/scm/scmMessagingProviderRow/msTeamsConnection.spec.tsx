import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as integrationUtil from 'sentry/utils/integrationUtil';

import {openMsTeamsConnectionModal} from './msTeamsConnection';

const TEAMS_MARKETPLACE_URL = 'https://teams.microsoft.com/l/app/test-app-id';

const providerBase = GitHubIntegrationProviderFixture({
  key: 'msteams',
  name: 'Microsoft Teams',
  canAdd: false,
});

const provider = {
  ...providerBase,
  metadata: {
    ...providerBase.metadata,
    aspects: {
      ...providerBase.metadata.aspects,
      externalInstall: {
        url: TEAMS_MARKETPLACE_URL,
        buttonText: 'Teams Marketplace',
        noticeText: 'Visit the Teams Marketplace to install this integration.',
      },
    },
  },
};

const providerWithoutExternalInstall = {
  ...providerBase,
  metadata: {
    ...providerBase.metadata,
    aspects: {
      ...providerBase.metadata.aspects,
      externalInstall: undefined,
    },
  },
};

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

  it('fires installation_start analytics when the marketplace button is clicked', async () => {
    const trackSpy = jest.spyOn(integrationUtil, 'trackIntegrationAnalytics');
    renderGlobalModal({organization});
    act(() => openMsTeamsConnectionModal(provider));

    await userEvent.click(screen.getByRole('button', {name: 'Teams Marketplace'}));

    expect(trackSpy).toHaveBeenCalledWith(
      'integrations.installation_start',
      expect.objectContaining({
        integration: 'msteams',
        view: 'onboarding',
        variant: 'scm',
      })
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
