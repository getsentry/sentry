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

    const trace = parseTrace(event);

    render(<TraceErrorList trace={trace} errors={errors} onClickSpan={jest.fn()} />);
    expect(screen.getByTestId('trace-error-list')).toHaveTextContent(
      '2 warning errors in /api/fetchitems'
    );
    expect(screen.getByTestId('trace-error-list')).toHaveTextContent(
      '1 error in /api/fetchitems'
    );
  });
});
