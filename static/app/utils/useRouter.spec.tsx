import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render} from 'sentry-test/reactTestingLibrary';

import useRouter from 'sentry/utils/useRouter';
import {RouteContext} from 'sentry/views/routeContext';

describe('useRouter', () => {
  it('returns the current router object', function () {
    let expectedRouter;
    let actualRouter;
    function HomePage() {
      actualRouter = useRouter();
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          expectedRouter = props.router;
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
      </Router>
    );
    expect(actualRouter).toEqual(expectedRouter);
  });

  it('throws error when called outside of routes provider', function () {
    // Error is expected, do not fail when calling console.error
    jest.spyOn(console, 'error').mockImplementation();
    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

    expect(() =>
      render(
        <RouteContext.Provider value={null}>
          <Router history={memoryHistory}>
            <Route
              path="/"
              component={() => {
                useRouter();
                return null;
              }}
            />
          </Router>
        </RouteContext.Provider>
      )
    ).toThrow(/useRouteContext called outside of routes provider/);
  });
});
