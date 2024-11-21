import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import FeatureFlagInlineCTA from 'sentry/components/events/featureFlags/featureFlagInlineCTA';

describe('featureFlagInlineCTA', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
  });

  it('shows an onboarding banner that may be dismissed', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {}},
    });
    const dismissMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
    });

    render(<FeatureFlagInlineCTA projectId="123" />);
    expect(await screen.findByText('Set Up Feature Flags')).toBeInTheDocument();

    // Open the snooze or dismiss dropdown
    await userEvent.click(screen.getByTestId('icon-close'));
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
    expect(screen.getByText('Snooze')).toBeInTheDocument();

    // Click dismiss
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Dismiss'}));
    expect(dismissMock).toHaveBeenCalledWith(
      '/organizations/org-slug/prompts-activity/',
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'issue_feature_flags_inline_onboarding',
          status: 'dismissed',
        }),
      })
    );
    expect(screen.queryByText('Set Up Feature Flags')).not.toBeInTheDocument();
  });

  it('shows an onboarding banner that may be snoozed', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {}},
    });
    const snoozeMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
    });

    render(<FeatureFlagInlineCTA projectId="123" />);
    expect(await screen.findByText('Set Up Feature Flags')).toBeInTheDocument();

    // Open the snooze or dismiss dropdown
    await userEvent.click(screen.getByTestId('icon-close'));
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
    expect(screen.getByText('Snooze')).toBeInTheDocument();

    // Click snooze
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Snooze'}));
    expect(snoozeMock).toHaveBeenCalledWith(
      '/organizations/org-slug/prompts-activity/',
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'issue_feature_flags_inline_onboarding',
          status: 'snoozed',
        }),
      })
    );
    expect(screen.queryByText('Set Up Feature Flags')).not.toBeInTheDocument();
  });

  it('does not render if already dismissed', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {
        data: {
          feature: 'issue_feature_flags_inline_onboarding',
          status: 'dismissed',
          dismissed_ts: 3,
        },
      },
    });

    render(<FeatureFlagInlineCTA projectId="123" />);
    expect(screen.queryByText('Set Up Feature Flags')).not.toBeInTheDocument();
  });
});
