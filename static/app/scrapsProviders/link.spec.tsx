import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Link} from '@sentry/scraps/link';
import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

describe('SentryLinkBehaviorProvider', () => {
  it('uses Sentry routing for object destinations without duplicating clicks', async () => {
    const onClick = jest.fn();
    const tracking = jest.fn();
    const {router} = render(
      <TrackingContextProvider value={tracking}>
        <Link
          to={{pathname: '/issues/', query: {query: 'is:unresolved'}, hash: '#details'}}
          onClick={onClick}
        >
          Issues
        </Link>
      </TrackingContextProvider>
    );
    const link = screen.getByRole('link', {name: 'Issues'});
    expect(link).toHaveAttribute('href', '/issues/?query=is%3Aunresolved#details');
    await userEvent.click(link);
    expect(router.location.pathname).toBe('/issues/');
    expect(router.location.query).toEqual({query: 'is:unresolved'});
    expect(router.location.hash).toBe('#details');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(tracking).toHaveBeenCalledTimes(1);
  });
});
