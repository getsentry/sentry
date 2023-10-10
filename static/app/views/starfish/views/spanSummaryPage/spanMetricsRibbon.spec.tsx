import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {SpanMetricsRibbon} from 'sentry/views/starfish/views/spanSummaryPage/spanMetricsRibbon';

describe('SpanMetricsRibbon', function () {
  const sampleMetrics = {
    [SpanMetricsField.SPAN_OP]: 'db',
    [`${SpanFunction.SPM}()`]: 17.8,
    [`avg(${SpanMetricsField.SPAN_SELF_TIME})`]: 127.1,
    [`sum(${SpanMetricsField.SPAN_SELF_TIME})`]: 1172319,
    [`${SpanFunction.TIME_SPENT_PERCENTAGE}()`]: 0.002,
  };

  it('renders basic metrics', function () {
    render(<SpanMetricsRibbon spanMetrics={sampleMetrics} />);

    expect(screen.getByText('17.8/min')).toBeInTheDocument();
    expect(screen.getByText('127.10ms')).toBeInTheDocument();
    expect(screen.getByText('19.54min')).toBeInTheDocument();
  });
});
