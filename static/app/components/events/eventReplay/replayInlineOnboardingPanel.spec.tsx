import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ReplayInlineOnboardingPanel from './replayInlineOnboardingPanel';

describe('replayInlineOnboardingPanel', () => {
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

    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.findByText('Watch the errors and latency issues your users face')
    ).toBeInTheDocument();

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
          feature: 'issue_replay_inline_onboarding',
          status: 'dismissed',
        }),
      })
    );
    expect(
      screen.queryByText('Watch the errors and latency issues your users face')
    ).not.toBeInTheDocument();
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

    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.findByText('Watch the errors and latency issues your users face')
    ).toBeInTheDocument();

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
          feature: 'issue_replay_inline_onboarding',
          status: 'snoozed',
        }),
      })
    );
    expect(
      screen.queryByText('Watch the errors and latency issues your users face')
    ).not.toBeInTheDocument();
  });

  it('does not render if already dismissed', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {
        data: {
          feature: 'issue_replay_inline_onboarding',
          status: 'dismissed',
          dismissed_ts: 3,
        },
      },
    });

    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      screen.queryByText('Watch the errors and latency issues your users face')
    ).not.toBeInTheDocument();
  });
});
