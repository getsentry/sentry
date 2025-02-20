import {BroadcastFixture} from 'sentry-fixture/broadcast';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {WhatsNew} from 'sentry/components/nav/primary/whatsNew';
import {BROADCAST_CATEGORIES} from 'sentry/components/sidebar/broadcastPanelItem';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

describe('WhatsNew', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      body: [],
    });
    jest.useRealTimers();
  });

  it('renders empty state', async function () {
    render(<WhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}));

    expect(await screen.findByText(/No recent updates/)).toBeInTheDocument();
  });

  it('displays unseen broadcasts indicator', async function () {
    jest.useFakeTimers();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      body: [
        BroadcastFixture({
          id: '1',
          title: 'Test Broadcast 1',
          category: 'blog',
          hasSeen: false,
        }),
        BroadcastFixture({
          id: '2',
          title: 'Test Broadcast 2',
          category: 'blog',
          hasSeen: false,
        }),
        BroadcastFixture({
          id: '3',
          title: 'Test Broadcast 3',
          category: 'blog',
          hasSeen: true,
        }),
      ],
    });

    render(<WhatsNew />);

    expect(await screen.findByTestId('whats-new-badge')).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      body: [],
    });

    await userEvent.click(screen.getByRole('button', {name: "What's New"}), {
      delay: null,
    });
    await screen.findByText('Test Broadcast 1');

    // Advance by 1 second to trigger the mark as seen delay
    act(() => jest.advanceTimersByTime(1000));

    await waitFor(() => {
      expect(screen.queryByTestId('whats-new-badge')).not.toBeInTheDocument();
    });
  });

  it('renders a broadcast item with media content correctly', async function () {
    const broadcast = BroadcastFixture({
      mediaUrl:
        'https://images.ctfassets.net/em6l9zw4tzag/2vWdw7ZaApWxygugalbyOC/285525e5b7c9fbfa8fb814a69ab214cd/PerformancePageSketches_hero.jpg?w=2520&h=945&q=50&fm=webp',
      category: 'blog',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      body: [broadcast],
    });

    render(<WhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}));

    // Verify that the broadcast content is rendered correctly
    expect(await screen.findByText(BROADCAST_CATEGORIES.blog)).toBeInTheDocument();
    const titleLink = screen.getByRole('link', {name: broadcast.title});
    expect(titleLink).toHaveAttribute('href', broadcast.link);
    expect(screen.getByText(/Source maps are JSON/)).toBeInTheDocument();

    // Simulate click and check if analytics tracking is called
    await userEvent.click(titleLink);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'whats_new.link_clicked',
      expect.objectContaining({
        title: broadcast.title,
        category: 'blog',
      })
    );
  });
});
