import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {render} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import {RouteContext} from 'sentry/views/routeContext';

describe('useNavigate', () => {
  it('returns the navigate function', function () {
    let navigate: ReturnType<typeof useNavigate> | undefined = undefined;

    function HomePage() {
      navigate = useNavigate();
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

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

    expect(typeof navigate).toBe('function');
  });
});
