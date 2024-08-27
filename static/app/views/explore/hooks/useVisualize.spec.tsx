import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useVisualize} from 'sentry/views/explore/hooks/useVisualize';
import {RouteContext} from 'sentry/views/routeContext';

describe('useVisualize', function () {
  it('allows changing results mode', function () {
    let visualize, setVisualize;

    function TestPage() {
      [visualize, setVisualize] = useVisualize();
      return null;
    }

    const memoryHistory = createMemoryHistory();

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
        <Route path="/" component={TestPage} />
      </Router>
    );

    expect(visualize).toEqual('count(span.duration)'); // default

    act(() => setVisualize('p75(span.duration)'));
    expect(visualize).toEqual('p75(span.duration)');

    act(() => setVisualize('count(span.duration)'));
    expect(visualize).toEqual('count(span.duration)');
  });
});
