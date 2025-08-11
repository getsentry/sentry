import {WidgetFixture} from 'sentry-fixture/widget';

import {WidgetType} from 'sentry/views/dashboards/types';
import {shouldForceQueryToSpans} from 'sentry/views/dashboards/utils/shouldForceQueryToSpans';

describe('shouldForceQueryToSpans', function () {
  it('return true if the widget is a transactions widget and uses measurements.inp', function () {
    const widget = WidgetFixture({
      widgetType: WidgetType.TRANSACTIONS,
      queries: [
        {
          fields: ['p75(measurements.inp)'],
          aggregates: ['p75(measurements.inp)'],
          columns: [],
          conditions: '',
          name: 'inp widget',
          orderby: '',
        },
      ],
    });

    expect(shouldForceQueryToSpans(widget)).toBe(true);
  });

  it('return false if the widget is not a transactions widget', function () {
    const widget = WidgetFixture({
      widgetType: WidgetType.TRANSACTIONS,
      queries: [
        {
          fields: ['p75(measurements.lcp)'],
          aggregates: ['p75(measurements.lcp)'],
          columns: [],
          conditions: '',
          name: 'lcp widget',
          orderby: '',
        },
      ],
    });

    expect(shouldForceQueryToSpans(widget)).toBe(false);
  });

  it('return false if the widget is a transactions widget and uses equations', function () {
    const widget = WidgetFixture({
      widgetType: WidgetType.TRANSACTIONS,
      queries: [
        {
          fields: ['equation|p75(measurements.inp)'],
          aggregates: ['equation|p75(measurements.inp)'],
          columns: [],
          conditions: '',
          name: 'equation widget',
          orderby: '',
        },
      ],
    });

    expect(shouldForceQueryToSpans(widget)).toBe(false);
  });

  it('return false if the widget is a transactions widget and uses percentile', function () {
    const widget = WidgetFixture({
      widgetType: WidgetType.TRANSACTIONS,
      queries: [
        {
          fields: ['percentile(measurements.inp, 0.9)'],
          aggregates: ['percentile(measurements.inp, 0.9)'],
          columns: [],
          conditions: '',
          name: 'percentile widget',
          orderby: '',
        },
      ],
    });

    expect(shouldForceQueryToSpans(widget)).toBe(false);
  });
});
