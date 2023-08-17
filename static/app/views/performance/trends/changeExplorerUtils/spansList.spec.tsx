import moment from 'moment';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  ChangedSuspectSpan,
  NumberedSpansList,
  SpanChangeType,
} from 'sentry/views/performance/trends/changeExplorerUtils/spansList';
import {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

const transaction: NormalizedTrendsTransaction = {
  aggregate_range_1: 78.2757131147541,
  aggregate_range_2: 110.50465131578949,
  breakpoint: 1687262400,
  project: 'sentry',
  transaction: 'sentry.tasks.store.save_event',
  trend_difference: 32.22893820103539,
  trend_percentage: 1.411736117354651,
  count: 3459,
  received_at: moment(1601251200000),
};

const longSpanList: ChangedSuspectSpan[] = [
  {
    op: 'db',
    group: '1',
    description: 'span1',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: 5,
    avgTimeDifference: 20,
    changeType: SpanChangeType.regressed,
  },
  {
    op: 'db',
    group: '2',
    description: 'span2',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: 2,
    avgTimeDifference: 19,
    changeType: SpanChangeType.regressed,
  },
  {
    op: 'db',
    group: '3',
    description: 'span3',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: 100,
    avgTimeDifference: 18,
    changeType: SpanChangeType.added,
  },
  {
    op: 'db',
    group: '4',
    description: 'span4',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: 0.5,
    avgTimeDifference: 17,
    changeType: SpanChangeType.regressed,
  },
  {
    op: 'db',
    group: '5',
    description: 'span5',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: 0.5,
    avgTimeDifference: 16,
    changeType: SpanChangeType.regressed,
  },
  {
    op: 'db',
    group: '6',
    description: 'span6',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: -5,
    avgTimeDifference: -1,
    changeType: SpanChangeType.improved,
  },
  {
    op: 'db',
    group: '7',
    description: 'span7',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: -0.5,
    avgTimeDifference: -2,
    changeType: SpanChangeType.improved,
  },
  {
    op: 'db',
    group: '8',
    description: 'span8',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: -100,
    avgTimeDifference: -3,
    changeType: SpanChangeType.removed,
  },
  {
    op: 'db',
    group: '9',
    description: 'span9',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: -100,
    avgTimeDifference: -4,
    changeType: SpanChangeType.removed,
  },
  {
    op: 'db',
    group: '10',
    description: 'span10',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: -3,
    avgTimeDifference: -5,
    changeType: SpanChangeType.improved,
  },
  {
    op: 'db',
    group: '11',
    description: 'span11',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: -0.5,
    avgTimeDifference: -6,
    changeType: SpanChangeType.improved,
  },
];

const shortSpanList: ChangedSuspectSpan[] = [
  {
    op: 'db',
    group: '1',
    description: 'span1',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: 5,
    avgTimeDifference: 20,
    changeType: SpanChangeType.regressed,
  },
  {
    op: 'db',
    group: '2',
    description: 'span2',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: 100,
    avgTimeDifference: 19,
    changeType: SpanChangeType.added,
  },
  {
    op: 'db',
    group: '3',
    description: 'span3',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: -0.5,
    avgTimeDifference: -3,
    changeType: SpanChangeType.improved,
  },
  {
    op: 'db',
    group: '4',
    description: 'span4',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
    avgSumExclusiveTime: 34,
    percentChange: -100,
    avgTimeDifference: -17,
    changeType: SpanChangeType.removed,
  },
];

describe('Performance > Trends > Performance Change Explorer > Spans List', function () {
  it('renders spans list for regression', async () => {
    const data = initializeData();

    render(
      <NumberedSpansList
        spans={longSpanList}
        location={data.location}
        organization={data.organization}
        transactionName={transaction.transaction}
        limit={6}
        isLoading={false}
        isError={false}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('list-item')[0]).toHaveTextContent('span1');
      expect(screen.getAllByTestId('list-item')[0]).toHaveTextContent('Regressed');
      expect(screen.getAllByTestId('list-item')[1]).toHaveTextContent('span2');
      expect(screen.getAllByTestId('list-item')[1]).toHaveTextContent('Regressed');
      expect(screen.getAllByTestId('list-item')[2]).toHaveTextContent('span3');
      expect(screen.getAllByTestId('list-item')[2]).toHaveTextContent('Added');
      expect(screen.getAllByTestId('list-item')[3]).toHaveTextContent('span6');
      expect(screen.getAllByTestId('list-item')[3]).toHaveTextContent('Improved');
      expect(screen.getAllByTestId('list-item')[4]).toHaveTextContent('span8');
      expect(screen.getAllByTestId('list-item')[4]).toHaveTextContent('Removed');
      expect(screen.getAllByTestId('list-item')[5]).toHaveTextContent('span9');
      expect(screen.getAllByTestId('list-item')[5]).toHaveTextContent('Removed');
      expect(screen.getAllByTestId('list-delta')).toHaveLength(6);
    });
  });

  it('renders spans list for improvement', async () => {
    const data = initializeData();

    render(
      <NumberedSpansList
        spans={longSpanList.reverse()}
        location={data.location}
        organization={data.organization}
        transactionName={transaction.transaction}
        limit={6}
        isLoading={false}
        isError={false}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('list-item')[0]).toHaveTextContent('span10');
      expect(screen.getAllByTestId('list-item')[0]).toHaveTextContent('Improved');
      expect(screen.getAllByTestId('list-item')[1]).toHaveTextContent('span9');
      expect(screen.getAllByTestId('list-item')[1]).toHaveTextContent('Removed');
      expect(screen.getAllByTestId('list-item')[2]).toHaveTextContent('span8');
      expect(screen.getAllByTestId('list-item')[2]).toHaveTextContent('Removed');
      expect(screen.getAllByTestId('list-item')[3]).toHaveTextContent('span6');
      expect(screen.getAllByTestId('list-item')[3]).toHaveTextContent('Improved');
      expect(screen.getAllByTestId('list-item')[4]).toHaveTextContent('span3');
      expect(screen.getAllByTestId('list-item')[4]).toHaveTextContent('Added');
      expect(screen.getAllByTestId('list-item')[5]).toHaveTextContent('span2');
      expect(screen.getAllByTestId('list-item')[5]).toHaveTextContent('Regressed');
      expect(screen.getAllByTestId('list-delta')).toHaveLength(6);
    });
  });

  it('renders spans list for smaller changed spans list', async () => {
    const data = initializeData();

    render(
      <NumberedSpansList
        spans={shortSpanList}
        location={data.location}
        organization={data.organization}
        transactionName={transaction.transaction}
        limit={6}
        isLoading={false}
        isError={false}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('list-item')[0]).toHaveTextContent('span1');
      expect(screen.getAllByTestId('list-item')[0]).toHaveTextContent('Regressed');
      expect(screen.getAllByTestId('list-item')[1]).toHaveTextContent('span2');
      expect(screen.getAllByTestId('list-item')[1]).toHaveTextContent('Added');
      expect(screen.getAllByTestId('list-item')[2]).toHaveTextContent('span3');
      expect(screen.getAllByTestId('list-item')[2]).toHaveTextContent('Improved');
      expect(screen.getAllByTestId('list-item')[3]).toHaveTextContent('span4');
      expect(screen.getAllByTestId('list-item')[3]).toHaveTextContent('Removed');
      expect(screen.getAllByTestId('list-item')[4]).toBeUndefined();
      expect(screen.getAllByTestId('list-delta')).toHaveLength(4);
    });
  });
});
