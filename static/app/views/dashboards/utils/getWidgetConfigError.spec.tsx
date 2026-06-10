import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {DisplayType} from 'sentry/views/dashboards/types';

import {getWidgetConfigError} from './getWidgetConfigError';

describe('getWidgetConfigError', () => {
  it.each([DisplayType.LINE, DisplayType.AREA, DisplayType.BAR, DisplayType.TOP_N])(
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
});
