import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventMissingBanner} from './eventMissingBanner';
import {GroupIdProvider} from './groupIdContext';

describe('EventMissingBanner', () => {
  it('renders elements for known event IDs', () => {
    const groupId = 'group-1';
    const initialRouterConfig = {
      location: {
        pathname: '/organizations/org-slug/issues/group-1/events/recommended/',
      },
      route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
    };

    render(
      <GroupIdProvider groupId={groupId}>
        <EventMissingBanner />
      </GroupIdProvider>,
      {initialRouterConfig}
    );

    // Header
    expect(screen.getByText(/We couldn't track down an event/)).toBeInTheDocument();
    // Body
    expect(screen.getByText(/here are some things to try/)).toBeInTheDocument();
    expect(screen.getByText(/Change up your filters./)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Clear event filters'})).toHaveAttribute(
      'href',
      expect.stringContaining(`/issues/${groupId}/events/recommended/`)
    );
    // Image
    expect(screen.getByAltText('Compass illustration')).toBeInTheDocument();
  });

  it('renders elements for specific event IDs', () => {
    const groupId = 'group-1';
    const initialRouterConfig = {
      location: {
        pathname: '/organizations/org-slug/issues/group-1/events/abc123/',
      },
      route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
    };

    render(
      <GroupIdProvider groupId={groupId}>
        <EventMissingBanner />
      </GroupIdProvider>,
      {initialRouterConfig}
    );

    // Header
    expect(screen.getByText(/We couldn't track down that event/)).toBeInTheDocument();
    expect(screen.getByText(/(abc123)/)).toBeInTheDocument();
    // Body
    expect(screen.getByText(/here are some things to try/)).toBeInTheDocument();
    expect(screen.getByText(/Double check the event ID./)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View recommended event'})).toHaveAttribute(
      'href',
      expect.stringContaining(`/issues/${groupId}/events/recommended/`)
    );
    // Image
    expect(screen.getByAltText('Compass illustration')).toBeInTheDocument();
  });
});
