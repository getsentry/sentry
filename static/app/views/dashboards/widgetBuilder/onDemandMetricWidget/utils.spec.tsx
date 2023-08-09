import {Widget, WidgetType} from '../../types';

import {isOnDemandMetricWidget} from './utils';

function widget(
  aggregates: string[],
  conditions: string,
  type: WidgetType = WidgetType.DISCOVER
) {
  const queries = aggregates.map(_ => ({
    aggregates,
    columns: [],
    conditions,
    name: '',
    orderby: '',
  }));

  return {
    widgetType: type,
    displayType: 'line',
    title: 'title',
    interval: '5m',
    queries,
  } as Widget;
}

describe('isOnDemandMetricWidget', () => {
  it('should return true for a widget that contains non standard fields', () => {
    expect(
      isOnDemandMetricWidget(widget(['count()'], 'transaction.duration:>1'))
    ).toBeTruthy();
    expect(isOnDemandMetricWidget(widget(['count()'], 'device.name:foo'))).toBeTruthy();
    expect(isOnDemandMetricWidget(widget(['count()'], 'geo.region:>US'))).toBeTruthy();
  });

  it('should return false for a widget that has only standard fields', () => {
    expect(isOnDemandMetricWidget(widget(['count()'], 'release:1.0'))).toBeFalsy();
    expect(isOnDemandMetricWidget(widget(['count()'], 'platform:foo'))).toBeFalsy();
  });

  it('should return false for a widget that has multiple or unsupported aggregates', () => {
    expect(
      isOnDemandMetricWidget(
        widget(['count()', 'count_unique()'], 'transaction.duration:>1')
      )
    ).toBeFalsy();
    expect(
      isOnDemandMetricWidget(widget(['apdex(100)'], 'transaction.duration:>1'))
    ).toBeFalsy();
  });
});
