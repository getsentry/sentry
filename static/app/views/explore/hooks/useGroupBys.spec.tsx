import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';

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

    render(
      <SpanTagsProvider>
        <TestPage />
      </SpanTagsProvider>,
      {disableRouterMocks: true}
    );

    await waitFor(() => expect(mockSpanTagsApiCall).toHaveBeenCalledTimes(1));
    expect(groupBys).toEqual(['']); // default

    act(() => setGroupBys(['foo', 'bar']));
    expect(groupBys).toEqual(['foo', 'bar']);

    act(() => setGroupBys([]));
    expect(groupBys).toEqual(['']); // default
  });
});
