import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {OnboardingBanner} from './onboardingBanner';

describe('OnboardingBanner', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    ConfigStore.set('user', UserFixture({dateJoined: '2025-01-01T00:00:00.000Z'}));
  });

  it('renders banner when user joined before cutoff and prompt is not dismissed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });

    render(<OnboardingBanner />, {organization});

    expect(
      await screen.findByText(/Alerts are now Monitors & Alerts/)
    ).toBeInTheDocument();
  });

  it('does not render when user joined on or after May 1, 2026', () => {
    ConfigStore.set('user', UserFixture({dateJoined: '2026-05-01T00:00:00.000Z'}));

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });

    render(<OnboardingBanner />, {organization});

    expect(
      screen.queryByText(/Alerts are now Monitors & Alerts/)
    ).not.toBeInTheDocument();
  });

  it('does not render when prompt is already dismissed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {data: {dismissed_ts: Date.now() / 1000}},
    });

    render(<OnboardingBanner />, {organization});

    await waitFor(() => {
      expect(
        screen.queryByText(/Alerts are now Monitors & Alerts/)
      ).not.toBeInTheDocument();
    });
  });

  it('dismisses banner when close button is clicked', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });

    const dismissMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      method: 'PUT',
      body: {},
    });

    render(<OnboardingBanner />, {organization});

    expect(
      await screen.findByText(/Alerts are now Monitors & Alerts/)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss banner'}));

    await waitFor(() => {
      expect(dismissMock).toHaveBeenCalled();
    });

    expect(
      screen.queryByText(/Alerts are now Monitors & Alerts/)
    ).not.toBeInTheDocument();
  });
});
