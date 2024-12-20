import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventMissingBanner} from 'sentry/views/issueDetails/streamline/eventMissingBanner';

describe('EventMissingBanner', () => {
  it('renders elements for known event IDs', () => {
    const organization = OrganizationFixture();
    const router = RouterFixture({params: {groupId: 'group-1', eventId: 'recommended'}});

    render(<EventMissingBanner />, {organization, router});

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
    const organization = OrganizationFixture();
    const router = RouterFixture({params: {groupId: 'group-1', eventId: 'abc123'}});

    render(<EventMissingBanner />, {organization, router});

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
