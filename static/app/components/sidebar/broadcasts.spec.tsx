import {BroadcastFixture} from 'sentry-fixture/broadcast';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
  const organization = OrganizationFixture({features: ['what-is-new-revamp']});

  it('renders empty state', async function () {
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

  it('renders item with media', async function () {
    renderMockRequests({
      orgSlug: organization.slug,
      broadcastsResponse: [BroadcastFixture({category: 'blog'})],
    });

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

    expect(await screen.findByText('Learn about Source Maps')).toBeInTheDocument();
    expect(screen.getByText(/blog post/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('img', {name: 'Learn about Source Maps'}));
    expect(trackAnalytics).toHaveBeenCalledWith(
      'whats_new.link_clicked',
      expect.objectContaining({
        title: 'Learn about Source Maps',
        category: 'blog',
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'cta_text'}));
    expect(trackAnalytics).toHaveBeenCalledTimes(2);
  });
});
