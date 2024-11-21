import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';

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
      ({setGroupBys} = useGroupBys());
      [resultMode, setResultMode] = useResultMode();
      return null;
    }

    render(
      <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP}>
        <TestPage />
      </SpanTagsProvider>,
      {disableRouterMocks: true}
    );

    expect(resultMode).toEqual('samples'); // default
    expect(sampleFields).toEqual([
      'id',
      'project',
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
      'id',
      'project',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
      'release',
    ]);
  });
});
