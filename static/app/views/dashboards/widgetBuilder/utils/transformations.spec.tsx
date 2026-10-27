import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {explodeFieldString} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderState} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToStateQueryParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToStateQueryParams';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {convertWidgetToQueryParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';

describe('widget transformation persistence', () => {
  it('round trips duplicate axes and distinct pipelines for each filter through the URL', () => {
    const widget = WidgetFixture({
      widgetType: WidgetType.SPANS,
      displayType: DisplayType.LINE,
      queries: [
        WidgetQueryFixture({
          aggregates: ['count()', 'count()'],
          columns: [],
          conditions: 'environment:production',
          transformations: {'0': ['fill(locf)', 'smooth(sma,5)'], '1': ['fill(zero)']},
        }),
        WidgetQueryFixture({
          aggregates: ['count()', 'count()'],
          columns: [],
          conditions: 'environment:development',
          transformations: {'1': ['smooth(ema,4,0.5)', 'fill(linear)']},
        }),
      ],
    });
    const params = convertWidgetToQueryParams(widget);
    const {result} = renderHookWithProviders(useWidgetBuilderState, {
      initialRouterConfig: {location: {pathname: '/mock-pathname/', query: params}},
    });

    expect(
      convertBuilderStateToWidget(result.current.state).queries.map(
        q => q.transformations
      )
    ).toEqual([
      {'0': ['fill(locf)', 'smooth(sma,5)'], '1': ['fill(zero)']},
      {'1': ['smooth(ema,4,0.5)', 'fill(linear)']},
    ]);
    expect(
      convertBuilderStateToStateQueryParams(result.current.state).transformations
    ).toBe(
      '[{"0":["fill(locf)","smooth(sma,5)"],"1":["fill(zero)"]},{"1":["smooth(ema,4,0.5)","fill(linear)"]}]'
    );
  });

  it('omits the transformations param for widgets without pipelines', () => {
    const widget = WidgetFixture({
      widgetType: WidgetType.SPANS,
      displayType: DisplayType.LINE,
      queries: [
        WidgetQueryFixture({aggregates: ['count()'], columns: [], transformations: {}}),
        WidgetQueryFixture({
          aggregates: ['count()'],
          columns: [],
          transformations: {'0': []},
        }),
      ],
    });

    expect(convertWidgetToQueryParams(widget)).not.toHaveProperty('transformations');
  });

  it('keeps transformations aligned when blank equations are excluded from saving', () => {
    const widget = convertBuilderStateToWidget({
      dataset: WidgetType.SPANS,
      displayType: DisplayType.LINE,
      yAxis: [
        {kind: 'function', function: ['count', '']},
        {kind: 'equation', field: ''},
        {kind: 'function', function: ['count', '']},
      ],
      transformations: [{'0': ['fill(zero)'], '2': ['smooth(sma,3)']}],
    });
    expect(widget.queries[0]).toEqual(
      expect.objectContaining({
        aggregates: ['count()', 'count()'],
        transformations: {'0': ['fill(zero)'], '1': ['smooth(sma,3)']},
      })
    );
  });

  it('saves an explicit empty map when all transformations are removed', () => {
    const widget = convertBuilderStateToWidget({
      dataset: WidgetType.TRACEMETRICS,
      displayType: DisplayType.LINE,
      yAxis: [explodeFieldString('sum(value,example_metric,counter,none)')],
      transformations: [{}],
    });
    expect(widget.queries[0]).toEqual(
      expect.objectContaining({
        aggregates: ['sum(value,example_metric,counter,none)'],
        transformations: {},
      })
    );
    const legacyWidget = convertBuilderStateToWidget({
      dataset: WidgetType.SPANS,
      displayType: DisplayType.LINE,
      yAxis: [{kind: 'function', function: ['count', '']}],
    });
    expect(legacyWidget.queries[0]).not.toHaveProperty('transformations');
  });
});
