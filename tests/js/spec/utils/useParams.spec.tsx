import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render} from 'sentry-test/reactTestingLibrary';

import {useParams} from 'sentry/utils/useParams';
import {RouteContext} from 'sentry/views/routeContext';

describe('useParams', () => {
  describe('when the path has no params', () => {
    it('returns an empty object', () => {
      let params;
      function HomePage() {
        params = useParams();
        return null;
      }

      const memoryHistory = createMemoryHistory();
      memoryHistory.push('/?hello');

      render(
        <Router
          history={memoryHistory}
          render={props => {
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

      expect(params).toEqual({});
    });
  });

  describe('when the path has some params', () => {
    it('returns an object of the URL params', () => {
      let params;
      function HomePage() {
        params = useParams();
        return null;
      }

      const memoryHistory = createMemoryHistory();
      memoryHistory.push('/sentry');

      render(
        <Router
          history={memoryHistory}
          render={props => {
            return (
              <RouteContext.Provider value={props}>
                <RouterContext {...props} />
              </RouteContext.Provider>
            );
          }}
        >
          <Route path="/:slug" component={HomePage} />
        </Router>
      );
      expect(params).toEqual({slug: 'sentry'});
    });
  });
});
