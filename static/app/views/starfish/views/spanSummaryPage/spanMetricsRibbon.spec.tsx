import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SpanMetricsFields, StarfishFunctions} from 'sentry/views/starfish/types';
import {SpanMetricsRibbon} from 'sentry/views/starfish/views/spanSummaryPage/spanMetricsRibbon';

describe('SpanMetricsRibbon', function () {
  const sampleMetrics = {
    [SpanMetricsFields.SPAN_OP]: 'db',
    [`${StarfishFunctions.SPM}()`]: 17.8,
    [`avg(${SpanMetricsFields.SPAN_SELF_TIME})`]: 127.1,
    [`sum(${SpanMetricsFields.SPAN_SELF_TIME})`]: 1172319,
    [`${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`]: 0.002,
  };

  it('renders basic metrics', function () {
    render(<SpanMetricsRibbon spanMetrics={sampleMetrics} />);

    expect(screen.getByText('17.8/min')).toBeInTheDocument();
    expect(screen.getByText('127.10ms')).toBeInTheDocument();
    expect(screen.getByText('19.54min')).toBeInTheDocument();
    expect(screen.getByText(/0.2%/)).toBeInTheDocument();
  });
});
