import {PageFilterStateFixture, PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {MockMetricQueryParamsContext} from 'sentry/views/explore/metrics/hooks/testUtils';
import {useValidateMetricsTab} from 'sentry/views/explore/metrics/hooks/useValidateMetricsTab';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

jest.mock('sentry/components/pageFilters/usePageFilters');

const validationBody: EventValidationData = {
  dataset: [],
  environment: [],
  field: [],
  orderby: [],
  projects: [],
  query: {
    error: null,
    fields: [{attrType: 'string', error: null, name: 'span.op', valid: true}],
    valid: true,
  },
  valid: true,
};

describe('useValidateMetricsTab', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: PageFiltersFixture({
          datetime: {period: '14d', start: null, end: null, utc: false},
          environments: ['production'],
          projects: [1],
        }),
      })
    );
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('returns validation data from the validate endpoint', async () => {
    const groupBy: GroupBy = {groupBy: 'environment'};
    const visualize = new VisualizeFunction('p95(value,test_metric,distribution,none)');
    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: 'span.op:http',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [groupBy, visualize],
      aggregateSortBys: [
        {field: 'p95(value,test_metric,distribution,none)', kind: 'desc'},
      ],
    });

    const validateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/validate/',
      body: validationBody,
    });

    const {result} = renderHookWithProviders(useValidateMetricsTab, {
      additionalWrapper: ({children}) => (
        <MockMetricQueryParamsContext
          metricQuery={{queryParams}}
          traceMetric={{name: 'test_metric', type: 'distribution'}}
        >
          {children}
        </MockMetricQueryParamsContext>
      ),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(validationBody);
    });
    expect(validateMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/validate/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: TraceItemDataset.TRACEMETRICS,
          environment: ['production'],
          field: ['environment', 'p95(value,test_metric,distribution,none)'],
          orderby: ['-p95(value,test_metric,distribution,none)'],
          project: ['1'],
          query: 'span.op:http',
          statsPeriod: '14d',
        }),
      })
    );
  });
});
