import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import RequestError from 'sentry/utils/requestError/requestError';

import {EventMissingBanner} from './eventMissingBanner';

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
  it('renders the error response if provided', () => {
    const organization = OrganizationFixture();

    const errorText = 'What a silly event ID';
    const eventError = new RequestError('GET', '/', new Error(errorText), {
      status: 404,
      responseJSON: {detail: errorText},
      responseText: errorText,
      statusText: errorText,
      getResponseHeader: () => '',
    });

    // Displays for known event IDs
    const {unmount} = render(<EventMissingBanner eventError={eventError} />, {
      organization,
      router: RouterFixture({params: {groupId: 'group-1', eventId: 'recommended'}}),
    });
    expect(screen.getByText(`${eventError.status}:`)).toBeInTheDocument();
    expect(screen.getByText(errorText)).toBeInTheDocument();
    unmount();

    // and for specific event IDs
    render(<EventMissingBanner eventError={eventError} />, {
      organization,
      router: RouterFixture({params: {groupId: 'group-1', eventId: 'abc123'}}),
    });
    expect(screen.getByText(`${eventError.status}:`)).toBeInTheDocument();
    expect(screen.getByText(errorText)).toBeInTheDocument();
  });
});
