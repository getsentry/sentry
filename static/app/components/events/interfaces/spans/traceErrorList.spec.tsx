import {TransactionEventFixture} from 'sentry-fixture/event';
import {SpanFixture} from 'sentry-fixture/span';
import {TraceErrorFixture} from 'sentry-fixture/traceError';
import {TracePerformanceIssueFixture} from 'sentry-fixture/tracePerformanceIssue';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TraceErrorList from 'sentry/components/events/interfaces/spans/traceErrorList';
import {parseTrace} from 'sentry/components/events/interfaces/spans/utils';
import {EntryType} from 'sentry/types/event';

describe('TraceErrorList', () => {
  it('aggregates errors by span and level', () => {
    const event = TransactionEventFixture({
      entries: [
        {
          type: EntryType.SPANS,
          data: [
            SpanFixture({
              op: '/api/fetchitems',
              span_id: '42118aba',
            }),
          ],
        },
      ],
    });

    const errors = [
      TraceErrorFixture({
        event_id: '1',
        span: '42118aba',
        level: 'warning',
      }),
      TraceErrorFixture({
        event_id: '2',
        span: '42118aba',
        level: 'warning',
      }),
      TraceErrorFixture({
        event_id: '3',
        span: '42118aba',
        level: 'error',
      }),
    ];

    render(<TraceErrorList trace={parseTrace(event)} errors={errors} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]).toHaveTextContent('2 warning errors in /api/fetchitems');
    expect(listItems[1]).toHaveTextContent('1 error in /api/fetchitems');
  });

  it('groups span-less errors under the transaction', () => {
    const event = TransactionEventFixture({
      contexts: {
        trace: {
          op: '/path',
        },
      },
      entries: [
        {
          type: EntryType.SPANS,
          data: [
            SpanFixture({
              op: '/api/fetchitems',
              span_id: '42118aba',
            }),
          ],
        },
      ],
    });

    const errors = [
      TraceErrorFixture({
        event_id: '1',
        level: 'warning',
      }),
    ];

    render(<TraceErrorList trace={parseTrace(event)} errors={errors} />);

    const listItem = screen.getByRole('listitem');
    expect(listItem).toHaveTextContent('1 warning error in /path');
  });

  it('groups performance issues separately', () => {
    const event = TransactionEventFixture({
      contexts: {
        trace: {
          op: '/path',
        },
      },
      entries: [
        {
          type: EntryType.SPANS,
          data: [
            SpanFixture({
              op: '/api/fetchitems',
              span_id: '42118aba',
            }),
          ],
        },
      ],
    });

    const errors = [
      TraceErrorFixture({
        event_id: '1',
        level: 'warning',
      }),
    ];

    const performanceIssues = [
      TracePerformanceIssueFixture({
        event_id: '1',
      }),
    ];

    render(
      <TraceErrorList
        trace={parseTrace(event)}
        errors={errors}
        performanceIssues={performanceIssues}
      />
    );

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]).toHaveTextContent('1 warning error in /path');
    expect(listItems[1]).toHaveTextContent('1 performance issue in /path');
  });
});
