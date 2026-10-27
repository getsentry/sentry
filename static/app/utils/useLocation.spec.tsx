import {render} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';

describe('useLocation', () => {
  it('returns the current location object', () => {
    let location: any;
    function HomePage() {
      // oxlint-disable-next-line react/globals -- Test captures the hook result in an outer variable to assert on it.
      location = useLocation();
      return null;
    }

    render(<HomePage />, {
      initialRouterConfig: {
        location: {
          pathname: '/issues/',
          query: {hello: 'world'},
        },
      },
    });

    expect(location.pathname).toBe('/issues/');
    expect(location.query).toEqual({hello: 'world'});
    expect(location.search).toBe('?hello=world');
  });
});
