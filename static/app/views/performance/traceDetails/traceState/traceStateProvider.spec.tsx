import {render, screen} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {DEFAULT_TRACE_VIEW_PREFERENCES} from './tracePreferences';
import {TraceStateProvider, useTraceState} from './traceStateProvider';

function SearchQuery() {
  const {search} = useTraceState();
  return <div>{search.query ?? 'no search'}</div>;
}

describe('TraceStateProvider', () => {
  afterEach(() => {
    setWindowLocation('http://localhost/');
  });

  it('seeds the search from the first value when the URL repeats it', () => {
    setWindowLocation('http://localhost/?search=first&search=second');

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <SearchQuery />
      </TraceStateProvider>
    );

    expect(screen.getByText('first')).toBeInTheDocument();
  });

  it('ignores the URL search when URL sync is disabled', () => {
    setWindowLocation('http://localhost/?search=first');

    render(
      <TraceStateProvider
        initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}
        disableUrlSync
      >
        <SearchQuery />
      </TraceStateProvider>
    );

    expect(screen.getByText('no search')).toBeInTheDocument();
  });
});
