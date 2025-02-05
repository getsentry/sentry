import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {PageParamsProvider} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function createWrapper(organization: Organization) {
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext.Provider value={organization}>
          <PageParamsProvider>
            <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
              {children}
            </SpanTagsProvider>
          </PageParamsProvider>
        </OrganizationContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('useSortByFields', () => {
  const organization = OrganizationFixture();

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/spans/fields/`,
      body: [],
    });

    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('returns a valid list of field options in samples mode', () => {
    const {result} = renderHook(
      () =>
        useSortByFields({
          fields: [
            'id',
            'span.op',
            'span.description',
            'span.duration',
            'transaction',
            'timestamp',
          ],
          groupBys: [],
          yAxes: ['avg(span.duration)'],
          mode: Mode.SAMPLES,
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    expect(result.current.map(field => field.value)).toEqual([
      'id',
      'span.description',
      'span.duration',
      'span.op',
      'timestamp',
      'transaction',
    ]);
  });

  it('returns a valid list of field options in aggregate mode', () => {
    const {result} = renderHook(
      () =>
        useSortByFields({
          fields: ['span.op', 'span.description'],
          groupBys: ['span.op'],
          yAxes: ['avg(span.duration)'],
          mode: Mode.AGGREGATE,
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    expect(result.current.map(field => field.value)).toEqual([
      'avg(span.duration)',
      'span.op',
    ]);
  });
});
