// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {RouteContext} from 'sentry/views/routeContext';

import {SpanTagsProvider} from '../contexts/spanTagsContext';

describe('useGroupBys', function () {
  it('allows changing group bys', async function () {
    const organization = OrganizationFixture();

    const mockSpanTagsApiCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [
        {
          key: 'foo',
          name: 'Foo',
        },
        {
          key: 'bar',
          name: 'Bar',
        },
      ],
    });

    let groupBys, setGroupBys;

    function TestPage() {
      ({groupBys, setGroupBys} = useGroupBys());
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

    await waitFor(() => expect(mockSpanTagsApiCall).toHaveBeenCalledTimes(1));
    expect(groupBys).toEqual(['']); // default

    act(() => setGroupBys(['foo', 'bar']));
    expect(groupBys).toEqual(['foo', 'bar']);

    act(() => setGroupBys([]));
    expect(groupBys).toEqual(['']); // default
  });
});
