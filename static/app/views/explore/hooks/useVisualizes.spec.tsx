import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {RouteContext} from 'sentry/views/routeContext';

describe('useVisualizes', function () {
  it('allows changing visualizes function', function () {
    let visualizes, setVisualizes;

    function TestPage() {
      [visualizes, setVisualizes] = useVisualizes();
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

    expect(visualizes).toEqual(['count(span.duration)']); // default

    act(() => setVisualizes(['p75(span.duration)']));
    expect(visualizes).toEqual(['p75(span.duration)']);

    act(() => setVisualizes(['']));
    expect(visualizes).toEqual(['count(span.duration)']);

    act(() => setVisualizes([]));
    expect(visualizes).toEqual(['count(span.duration)']);

    act(() => setVisualizes(['count(span.duration)']));
    expect(visualizes).toEqual(['count(span.duration)']);

    act(() => setVisualizes(['count(span.duration)', 'p75(span.duration)']));
    expect(visualizes).toEqual(['count(span.duration)', 'p75(span.duration)']);
  });
});
