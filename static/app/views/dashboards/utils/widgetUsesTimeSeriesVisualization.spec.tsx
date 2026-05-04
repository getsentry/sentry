import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {widgetUsesTimeSeriesVisualization} from 'sentry/views/dashboards/utils/widgetUsesTimeSeriesVisualization';

function makeWidget(widgetType: WidgetType | undefined, displayType: DisplayType): any {
  return {widgetType, displayType};
}

describe('widgetUsesTimeSeriesVisualization', () => {
  it.each([DisplayType.LINE, DisplayType.AREA, DisplayType.BAR])(
    'returns true for %s display type',
    displayType => {
      expect(
        widgetUsesTimeSeriesVisualization(
          makeWidget(WidgetType.TRANSACTIONS, displayType)
        )
      ).toBe(true);
    }
  );

  it.each([WidgetType.DISCOVER, WidgetType.METRICS, WidgetType.TRANSACTIONS])(
    'returns true for formerly unsupported widget type %s',
    widgetType => {
      expect(
        widgetUsesTimeSeriesVisualization(makeWidget(widgetType, DisplayType.LINE))
      ).toBe(true);
    }
  );

  it.each([DisplayType.TABLE, DisplayType.BIG_NUMBER, DisplayType.TEXT])(
    'returns false for non-time-series display type %s',
    displayType => {
      expect(
        widgetUsesTimeSeriesVisualization(makeWidget(WidgetType.SPANS, displayType))
      ).toBe(false);
    }
  );

  it('returns false when widgetType is undefined', () => {
    expect(
      widgetUsesTimeSeriesVisualization(makeWidget(undefined, DisplayType.LINE))
    ).toBe(false);
  });
});
