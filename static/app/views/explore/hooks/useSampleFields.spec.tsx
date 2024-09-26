// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {RouteContext} from 'sentry/views/routeContext';

describe('useSampleFields', function () {
  it('allows changing sample fields', function () {
    let sampleFields, setSampleFields;

    function TestPage() {
      [sampleFields, setSampleFields] = useSampleFields();
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

    expect(sampleFields).toEqual([
      'project',
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
    ]); // default

    act(() => setSampleFields(['foo', 'bar']));
    expect(sampleFields).toEqual(['foo', 'bar']);

    act(() => setSampleFields([]));
    expect(sampleFields).toEqual([
      'project',
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
    ]); // default
  });
});
