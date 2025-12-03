import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventMissingBanner} from 'sentry/views/issueDetails/streamline/eventMissingBanner';

describe('EventMissingBanner', () => {
  it('renders elements for known event IDs', () => {
    const initialRouterConfig = {
      location: {
        pathname: `/organizations/org-slug/issues/group-1/events/recommended/`,
      },
      route: `/organizations/:orgId/issues/:groupId/events/:eventId/`,
    };

    render(<EventMissingBanner />, {
      initialRouterConfig,
    });

    // Header
    expect(screen.getByText(/We couldn't track down an event/)).toBeInTheDocument();
    // Body
    expect(screen.getByText(/here are some things to try/)).toBeInTheDocument();
    expect(screen.getByText(/Change up your filters./)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Clear event filters'})).toBeInTheDocument();
    // Image
    expect(screen.getByAltText('Compass illustration')).toBeInTheDocument();
  });

  it('renders elements for specific event IDs', () => {
    const initialRouterConfig = {
      location: {
        pathname: `/organizations/org-slug/issues/group-1/events/abc123/`,
      },
      route: `/organizations/:orgId/issues/:groupId/events/:eventId/`,
    };

    render(<EventMissingBanner />, {
      initialRouterConfig,
    });

    // Header
    expect(screen.getByText(/We couldn't track down that event/)).toBeInTheDocument();
    expect(screen.getByText(/(abc123)/)).toBeInTheDocument();
    // Body
    expect(screen.getByText(/here are some things to try/)).toBeInTheDocument();
    expect(screen.getByText(/Double check the event ID./)).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'View recommended event'})
    ).toBeInTheDocument();
    // Image
    expect(screen.getByAltText('Compass illustration')).toBeInTheDocument();
  });
});
