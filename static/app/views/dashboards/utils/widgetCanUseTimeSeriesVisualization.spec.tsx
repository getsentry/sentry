import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {widgetCanUseTimeSeriesVisualization} from 'sentry/views/dashboards/utils/widgetCanUseTimeSeriesVisualization';

function makeWidget(widgetType: WidgetType | undefined, displayType: DisplayType): any {
  return {widgetType, displayType};
}

describe('widgetCanUseTimeSeriesVisualization', () => {
  it.each([DisplayType.LINE, DisplayType.AREA, DisplayType.BAR, DisplayType.TOP_N])(
    'returns true for %s display type',
    displayType => {
      expect(
        widgetCanUseTimeSeriesVisualization(
          makeWidget(WidgetType.TRANSACTIONS, displayType)
        )
      ).toBe(true);
    }
  );

  it.each([WidgetType.DISCOVER, WidgetType.METRICS, WidgetType.TRANSACTIONS])(
    'returns true for formerly unsupported widget type %s',
    widgetType => {
      expect(
        widgetCanUseTimeSeriesVisualization(makeWidget(widgetType, DisplayType.LINE))
      ).toBe(true);
    }
  );

  it.each([DisplayType.TABLE, DisplayType.BIG_NUMBER, DisplayType.TEXT])(
    'returns false for non-time-series display type %s',
    displayType => {
      expect(
        widgetCanUseTimeSeriesVisualization(makeWidget(WidgetType.SPANS, displayType))
      ).toBe(false);
    }
  );

  it('returns false when widgetType is undefined', () => {
    expect(
      widgetCanUseTimeSeriesVisualization(makeWidget(undefined, DisplayType.LINE))
    ).toBe(false);
  });
});
