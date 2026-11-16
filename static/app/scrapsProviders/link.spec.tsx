import {
  render,
  renderHookWithProviders,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {Link, useResolveLinkHref, type LinkProps} from '@sentry/scraps/link';
import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

describe('SentryLinkBehaviorProvider', () => {
  it.each<[LinkProps['to'], string]>([
    [{query: {q: 'a b'}}, '?q=a%20b'],
    [{hash: 'details'}, '#details'],
    [{}, ''],
  ])('keeps destinations without a pathname relative: %j', (to, href) => {
    const {result} = renderHookWithProviders(() => useResolveLinkHref());
    expect(result.current(to)).toBe(href);
  });

  it('resolves collection hrefs with the same query encoding as router links', () => {
    const to: LinkProps['to'] = {
      pathname: '/issues/',
      search: '?old=true',
      query: {tag: ['one', 'two'], query: 'a b+c~*', flag: null, absent: undefined},
      hash: 'details',
    };
    const href = '/issues/?flag&query=a%20b%2Bc~%2A&tag=one&tag=two#details';
    render(<Link to={to}>Issues</Link>);
    expect(screen.getByRole('link', {name: 'Issues'})).toHaveAttribute('href', href);

    const {result} = renderHookWithProviders(() => useResolveLinkHref());
    expect(result.current(to)).toBe(href);
    expect(result.current('/issues/?query=a%20b#details')).toBe(
      '/issues/?query=a%20b#details'
    );
  });

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
