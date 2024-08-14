import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {RouteContext} from 'sentry/views/routeContext';

describe('useResultMode', function () {
  it('allows changing results mode', function () {
    let resultMode, setResultMode;

    function TestPage() {
      [resultMode, setResultMode] = useResultMode();
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

    expect(resultMode).toEqual('samples'); // default

    act(() => setResultMode('aggregate'));
    expect(resultMode).toEqual('aggregate');

    act(() => setResultMode('samples'));
    expect(resultMode).toEqual('samples');
  });
});
