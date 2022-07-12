import {render, screen} from 'sentry-test/reactTestingLibrary';

import TraceErrorList from 'sentry/components/events/interfaces/spans/traceErrorList';
import {parseTrace} from 'sentry/components/events/interfaces/spans/utils';

describe('TraceErrorList', () => {
  it('aggregates errors by span and level', () => {
    const event = TestStubs.Event({
      entries: [
        {
          type: 'spans',
          data: [
            TestStubs.Span({
              op: '/api/fetchitems',
              span_id: '42118aba',
            }),
          ],
        },
      ],
    });

    const errors = [
      TestStubs.TraceError({
        event_id: '1',
        span: '42118aba',
        level: 'warning',
      }),
      TestStubs.TraceError({
        event_id: '2',
        span: '42118aba',
        level: 'warning',
      }),
      TestStubs.TraceError({
        event_id: '3',
        span: '42118aba',
        level: 'error',
      }),
    ];

    render(
      <TraceErrorList trace={parseTrace(event)} errors={errors} onClickSpan={jest.fn()} />
    );

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]).toHaveTextContent('2 warning errors in /api/fetchitems');
    expect(listItems[1]).toHaveTextContent('1 error in /api/fetchitems');
  });

  it('groups span-less errors under the transaction', () => {
    const event = TestStubs.Event({
      contexts: {
        trace: {
          op: '/path',
        },
      },
      entries: [
        {
          type: 'spans',
          data: [
            TestStubs.Span({
              op: '/api/fetchitems',
              span_id: '42118aba',
            }),
          ],
        },
      ],
    });

    const errors = [
      TestStubs.TraceError({
        event_id: '1',
        level: 'warning',
      }),
    ];

    render(
      <TraceErrorList trace={parseTrace(event)} errors={errors} onClickSpan={jest.fn()} />
    );

    const listItem = screen.getByRole('listitem');
    expect(listItem).toHaveTextContent('1 warning error in /path');
  });
});
