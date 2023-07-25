import {renderHook} from '@testing-library/react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import {UseQueryResult} from 'sentry/utils/queryClient';
import * as spanMetrics from 'sentry/views/starfish/queries/useSpanMetrics';
import * as spanSamples from 'sentry/views/starfish/queries/useSpanSamples';
import * as spanTransactionMetrics from 'sentry/views/starfish/queries/useSpanTransactionMetrics';

import SampleTable from './sampleTable';

const DEFAULT_SELECTION: PageFilters = {
  datetime: {
    period: '14d',
    start: null,
    end: null,
    utc: false,
  },
  environments: [],
  projects: [],
};

jest.mock('sentry/utils/usePageFilters', () => {
  return {
    __esModule: true,
    default: () => ({isReady: true, selection: DEFAULT_SELECTION}),
  };
});

const spanMetricsSpy = jest.spyOn(spanMetrics, 'useSpanMetrics');
const spanSamplesSpy = jest.spyOn(spanSamples, 'useSpanSamples');
const spanTransactionMetricsSpy = jest.spyOn(
  spanTransactionMetrics,
  'useSpanTransactionMetrics'
);

describe('SampleTable', function () {
  describe('When all data is availble', () => {
    it('should load', async () => {
      spanMetricsSpy.mockReturnValue({
        data: [{'span.op': 'db', 'p95(span.self_time)': 0.52}],
        isFetching: false,
        isLoading: false,
      } as any);

      spanSamplesSpy.mockReturnValue({
        data: [
          {
            timestamp: '2023-07-23T21:41:59+00:00',
            project: 'sentry',
            'transaction.id': '5732871d33994930823be72c042eccd1',
            span_id: '80194b65974c6b07',
            'span.self_time': 2.058,
          },
        ],
        isFetching: false,
        isLoading: false,
        isEnabled: true,
      } as any);

      spanTransactionMetricsSpy.mockReturnValue({
        data: [
          {
            'transaction.op': 'http.server',
            transaction: '/api/0/organizations/{organization_slug}/issues/',
            'transaction.method': 'GET',
            'http_error_count()': 0,
            'time_spent_percentage(local)': 0.09279880078817074,
            'sps()': 38.73400462962963,
            'sum(span.self_time)': 3464729.707,
            'p95(span.self_time)': 2.6674499999999997,
          },
        ],
        isLoading: false,
        isFetching: false,
      } as any);

      const container = render(
        <SampleTable
          groupId="groupId123"
          transactionMethod="GET"
          transactionName="/endpoint"
        />
      );

      const loadingIndicator = await container.findByTestId('loading-indicator');
      expect(loadingIndicator).toBeInTheDocument();
    });
  });
});
