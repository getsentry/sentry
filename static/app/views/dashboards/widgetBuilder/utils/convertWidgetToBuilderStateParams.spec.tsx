import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getDefaultWidget} from 'sentry/views/dashboards/widgetBuilder/utils/getDefaultWidget';

describe('convertWidgetToBuilderStateParams', () => {
  it('should not pass along yAxis when converting a table to builder params', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      displayType: DisplayType.TABLE,
      aggregates: ['count()'],
    };
    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.yAxis).toEqual([]);
  });

  it('stringifies the fields when converting a table to builder params', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      displayType: DisplayType.TABLE,
      queries: [
        {
          aggregates: [],
          columns: [],
          conditions: '',
          name: '',
          orderby: '',

          fields: ['geo.country'],
          fieldAliases: ['test'],
        },
      ],
    };
    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.field).toEqual(['{"field":"geo.country","alias":"test"}']);
  });

  it('adds legend aliases to the builder params on charts', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      displayType: DisplayType.AREA,
      queries: [
        {
          aggregates: [],
          columns: [],
          conditions: 'transaction.duration:>100',
          orderby: '',
          name: 'test',
        },
        {
          aggregates: [],
          columns: [],
          conditions: 'transaction.duration:>50',
          orderby: '',
          name: 'test2',
        },
      ],
    };
    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.legendAlias).toEqual(['test', 'test2']);
  });

  it('does not duplicate filters because of multiple widget queries', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      displayType: DisplayType.LINE,
      queries: [
        {
          aggregates: ['count()'],
          columns: [],
          conditions: 'one condition',
          orderby: '',
          name: '',
        },
        {
          aggregates: ['count()'],
          columns: [],
          conditions: 'second condition',
          orderby: '',
          name: '',
        },
      ],
    };

    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.query).toEqual(['one condition', 'second condition']);
    expect(params.yAxis).toEqual(['count()']);
  });

  it('exposes the selected aggregate in a widget query', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      queries: [
        {
          aggregates: ['count()'],
          selectedAggregate: 0,
          columns: [],
          conditions: '',
          name: '',
          orderby: '',
        },
      ],
    };
    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.selectedAggregate).toBe(0);
  });

  it('includes the thresholds in the builder params', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.TRANSACTIONS),
      thresholds: {
        max_values: {
          max1: 200,
          max2: 300,
        },
        unit: 'milliseconds',
      },
    };
    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.thresholds).toBe(
      '{"max_values":{"max1":200,"max2":300},"unit":"milliseconds"}'
    );
  });
});
