import {BroadcastFixture} from 'sentry-fixture/broadcast';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BROADCAST_CATEGORIES} from 'sentry/components/sidebar/broadcastPanelItem';
import Broadcasts from 'sentry/components/sidebar/broadcasts';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import type {Broadcast} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

function renderMockRequests({
  orgSlug,
  broadcastsResponse,
}: {
  orgSlug: string;
  broadcastsResponse?: Broadcast[];
}) {
  MockApiClient.addMockResponse({
    url: '/broadcasts/',
    method: 'PUT',
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/broadcasts/`,
    body: broadcastsResponse ?? [],
  });
}

describe('Broadcasts', function () {
  const category = 'blog';

  it('renders empty state', async function () {
    const organization = OrganizationFixture();

    renderMockRequests({orgSlug: organization.slug});

    render(
      <Broadcasts
        orientation="left"
        collapsed={false}
        currentPanel={SidebarPanelKey.BROADCASTS}
        onShowPanel={() => jest.fn()}
        hidePanel={jest.fn()}
        organization={organization}
      />
    );

    expect(await screen.findByText(/No recent updates/)).toBeInTheDocument();
  });

  it('renders a broadcast item with media content correctly', async function () {
    const organization = OrganizationFixture();
    const broadcast = BroadcastFixture({
      mediaUrl:
        'https://images.ctfassets.net/em6l9zw4tzag/2vWdw7ZaApWxygugalbyOC/285525e5b7c9fbfa8fb814a69ab214cd/PerformancePageSketches_hero.jpg?w=2520&h=945&q=50&fm=webp',
      category,
    });

    renderMockRequests({orgSlug: organization.slug, broadcastsResponse: [broadcast]});

    render(
      <Broadcasts
        orientation="left"
        collapsed={false}
        currentPanel={SidebarPanelKey.BROADCASTS}
        onShowPanel={() => jest.fn()}
        hidePanel={jest.fn()}
        organization={organization}
      />
    );

    // Verify that the broadcast content is rendered correctly
    expect(await screen.findByText(BROADCAST_CATEGORIES[category])).toBeInTheDocument();
    const titleLink = screen.getByRole('link', {name: broadcast.title});
    expect(titleLink).toHaveAttribute('href', broadcast.link);
    expect(screen.getByText(/Source maps are JSON/)).toBeInTheDocument();

    // Simulate click and check if analytics tracking is called
    await userEvent.click(titleLink);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'whats_new.link_clicked',
      expect.objectContaining({
        title: broadcast.title,
        category,
      })
    );
  });
});
