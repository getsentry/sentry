import {Fragment} from 'react';
import {Outlet} from 'react-router';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {Redirect as RouteRedirect} from 'sentry/router/translateSentryRoute';

import {Redirect} from './redirect';

describe('Redirect', () => {
  it.each([Redirect, RouteRedirect])(
    'preserves destination state and interpolates route parameters (%#)',
    RedirectComponent => {
      const {router} = render(<Outlet />, {
        initialRouterConfig: {
          location: {pathname: '/from/123/'},
          route: '/',
          children: [
            {
              path: 'from/:id/',
              element: (
                <RedirectComponent
                  to="/to/:id/?tab=details#section"
                  state={{source: 'test'}}
                />
              ),
            },
            {path: 'to/:id/', element: <div>Destination</div>},
          ],
        },
      });

      expect(screen.getByText('Destination')).toBeInTheDocument();
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/to/123/',
          query: {tab: 'details'},
          hash: '#section',
          state: {
            source: 'test',
            redirectFromLocationKey: expect.any(String),
          },
        })
      );
    }
  );

  it('replaces the redirect route in history by default', () => {
    const {router} = render(<Outlet />, {
      initialRouterConfig: {
        location: {pathname: '/start/'},
        route: '/',
        children: [
          {path: 'start/', element: <div>Start</div>},
          {path: 'redirect/', element: <Redirect to="/destination/" />},
          {path: 'destination/', element: <div>Destination</div>},
        ],
      },
    });

    act(() => router.navigate('/redirect/'));
    expect(screen.getByText('Destination')).toBeInTheDocument();
    act(() => router.navigate(-1));
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('does not redirect again when the redirect stays mounted at the destination', () => {
    const {router, rerender} = render(
      <Fragment>
        <Redirect to="/destination/" />
        <Outlet />
      </Fragment>,
      {
        initialRouterConfig: {
          location: {pathname: '/'},
          route: '/',
          children: [{path: 'destination/', element: <div>Destination</div>}],
        },
      }
    );
    const destinationKey = router.location.key;

    rerender(
      <Fragment>
        <Redirect to="/destination/" />
        <Outlet />
      </Fragment>
    );

    expect(screen.getByText('Destination')).toBeInTheDocument();
    expect(router.location.key).toBe(destinationKey);
  });
});
