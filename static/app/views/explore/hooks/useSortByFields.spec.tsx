import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function createWrapper(organization: Organization) {
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>
          <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
            {children}
          </TraceItemAttributeProvider>
        </OrganizationContext>
      </QueryClientProvider>
    );
  };
}

describe('useSortByFields', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/`,
      body: [],
    });

    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('returns a valid list of field options in samples mode', () => {
    const {result} = renderHook(useSortByFields, {
      wrapper: createWrapper(organization),
      initialProps: {
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
      },
    });

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
    const {result} = renderHook(useSortByFields, {
      wrapper: createWrapper(organization),
      initialProps: {
        fields: ['span.op', 'span.description'],
        groupBys: ['span.op'],
        yAxes: ['avg(span.duration)'],
        mode: Mode.AGGREGATE,
      },
    });

    expect(result.current.map(field => field.value)).toEqual([
      'avg(span.duration)',
      'span.op',
    ]);
  });
});
