import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {hasUnresolvedTraceMetric} from 'sentry/views/dashboards/widgetBuilder/utils/hasUnresolvedTraceMetric';

describe('hasUnresolvedTraceMetric', () => {
  it('is true when an aggregate carries no metric', () => {
    // `sum(value)` is the placeholder aggregate — no metric name/type encoded.
    const widget = WidgetFixture({
      queries: [WidgetQueryFixture({aggregates: ['sum(value)']})],
    });

    expect(hasUnresolvedTraceMetric(widget)).toBe(true);
  });

  it('is false when every aggregate resolves to a metric', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({aggregates: ['sum(value,test_metric,distribution,none)']}),
      ],
    });

    expect(hasUnresolvedTraceMetric(widget)).toBe(false);
  });

  it('is true when any query has an unresolved aggregate', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({aggregates: ['sum(value,test_metric,distribution,none)']}),
        WidgetQueryFixture({aggregates: ['sum(value)']}),
      ],
    });

    expect(hasUnresolvedTraceMetric(widget)).toBe(true);
  });

  it('ignores equations, which carry no metric tuple', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({
          aggregates: ['sum(value,test_metric,distribution,none)', 'equation|1 + 1'],
        }),
      ],
    });

    expect(hasUnresolvedTraceMetric(widget)).toBe(false);
  });
});
