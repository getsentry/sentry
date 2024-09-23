// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {RouteContext} from 'sentry/views/routeContext';

import {SpanTagsProvider} from '../contexts/spanTagsContext';

describe('useResultMode', function () {
  it('allows changing results mode', function () {
    let resultMode, setResultMode;
    let sampleFields;
    let setGroupBys;

    const organization = OrganizationFixture();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [],
    });

    function TestPage() {
      [sampleFields] = useSampleFields();
      [, setGroupBys] = useGroupBys();
      [resultMode, setResultMode] = useResultMode();
      return null;
    }

    const memoryHistory = createMemoryHistory();

    render(
      <SpanTagsProvider>
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
      </SpanTagsProvider>
    );

    expect(resultMode).toEqual('samples'); // default
    expect(sampleFields).toEqual([
      'project',
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
    ]); // default

    act(() => setResultMode('aggregate'));
    expect(resultMode).toEqual('aggregate');

    act(() => setGroupBys(['release', '']));

    act(() => setResultMode('samples'));
    expect(resultMode).toEqual('samples');

    expect(sampleFields).toEqual([
      'project',
      'id',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
      'release',
    ]);
  });
});
