import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {getWidgetConfigError} from './getWidgetConfigError';

describe('getWidgetConfigError', () => {
  it.each([DisplayType.LINE, DisplayType.AREA, DisplayType.BAR])(
    'returns an error for %s widgets with no aggregates',
    displayType => {
      const widget = WidgetFixture({
        displayType,
        queries: [WidgetQueryFixture({aggregates: []})],
      });

      expect(getWidgetConfigError(widget)).toBeDefined();
    }
  );

  it('returns undefined for time series widgets with aggregates', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [WidgetQueryFixture({aggregates: ['count()']})],
    });

    expect(getWidgetConfigError(widget)).toBeUndefined();
  });

  it('returns undefined for table widgets with no aggregates', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [WidgetQueryFixture({aggregates: []})],
    });

    expect(getWidgetConfigError(widget)).toBeUndefined();
  });

  it('returns undefined for big number widgets with no aggregates', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.BIG_NUMBER,
      queries: [WidgetQueryFixture({aggregates: []})],
    });

    expect(getWidgetConfigError(widget)).toBeUndefined();
  });

  it('returns undefined when at least one query has aggregates', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        WidgetQueryFixture({aggregates: []}),
        WidgetQueryFixture({aggregates: ['count()']}),
      ],
    });

    expect(getWidgetConfigError(widget)).toBeUndefined();
  });

  it('returns an error when the dataset does not support the display type', () => {
    // Issues don't support big number widgets.
    const widget = WidgetFixture({
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.ISSUE,
      queries: [WidgetQueryFixture({aggregates: ['count()']})],
    });

    expect(getWidgetConfigError(widget)).toBeDefined();
  });

  it.each([
    DisplayType.TEXT,
    DisplayType.WHEEL,
    DisplayType.RAGE_AND_DEAD_CLICKS,
    DisplayType.AGENTS_TRACES_TABLE,
  ])(
    'returns undefined for special %s widgets that are not dataset-driven',
    displayType => {
      // These widgets aren't backed by a dataset, so the dataset/display-type
      // compatibility check must not flag them regardless of widgetType.
      const widget = WidgetFixture({
        displayType,
        widgetType: WidgetType.ERRORS,
        queries: [WidgetQueryFixture({aggregates: []})],
      });

      expect(getWidgetConfigError(widget)).toBeUndefined();
    }
  );

  it('returns an error for heat map widgets on an unsupported dataset', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.HEATMAP,
      widgetType: WidgetType.SPANS,
      queries: [
        WidgetQueryFixture({aggregates: ['count(value,test_metric,distribution,none)']}),
      ],
    });

    expect(getWidgetConfigError(widget)).toBeDefined();
  });

  it('returns an error for heat map widgets whose aggregate has no metric', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.HEATMAP,
      widgetType: WidgetType.TRACEMETRICS,
      queries: [WidgetQueryFixture({aggregates: ['sum(value)']})],
    });

    expect(getWidgetConfigError(widget)).toBeDefined();
  });

  it('returns undefined for heat map widgets with a resolvable metric', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.HEATMAP,
      widgetType: WidgetType.TRACEMETRICS,
      queries: [
        WidgetQueryFixture({aggregates: ['count(value,test_metric,distribution,none)']}),
      ],
    });

    expect(getWidgetConfigError(widget)).toBeUndefined();
  });
});
