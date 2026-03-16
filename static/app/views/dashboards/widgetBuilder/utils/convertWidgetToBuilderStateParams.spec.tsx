import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  convertWidgetToBuilderState,
  convertWidgetToQueryParams,
} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getDefaultWidget} from 'sentry/views/dashboards/widgetBuilder/utils/getDefaultWidget';

describe('convertWidgetToBuilderStateParams', () => {
  it('should not pass along yAxis when converting a table to builder params', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      displayType: DisplayType.TABLE,
      aggregates: ['count()'],
    };
    const params = convertWidgetToQueryParams(widget);
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
    const params = convertWidgetToQueryParams(widget);
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
    const params = convertWidgetToQueryParams(widget);
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

    const params = convertWidgetToQueryParams(widget);
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
    const params = convertWidgetToQueryParams(widget);
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
    const params = convertWidgetToQueryParams(widget);
    expect(params.thresholds).toBe(
      '{"max_values":{"max1":200,"max2":300},"unit":"milliseconds"}'
    );
  });

  it('defaults axisRange to auto when widget axisRange is null', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      axisRange: null,
    };

    const params = convertWidgetToQueryParams(
      widget as unknown as Parameters<typeof convertWidgetToQueryParams>[0]
    );
    expect(params.axisRange).toBe('auto');
  });

  it('defaults axisRange to auto when widget axisRange is invalid', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      axisRange: 'invalid',
    };

    const params = convertWidgetToQueryParams(
      widget as unknown as Parameters<typeof convertWidgetToQueryParams>[0]
    );
    expect(params.axisRange).toBe('auto');
  });

  describe('traceMetric', () => {
    it('includes the trace metric in the builder params', () => {
      const widget = WidgetFixture({
        ...getDefaultWidget(WidgetType.TRACEMETRICS),
        queries: [
          {
            aggregates: ['avg(value,test-metric,distribution,second)'],
            columns: [],
            conditions: '',
            name: '',
            orderby: '',
          },
        ],
      });
      const params = convertWidgetToQueryParams(widget);
      expect(JSON.parse(params.traceMetric!)).toEqual({
        name: 'test-metric',
        type: 'distribution',
        unit: 'second',
      });
    });
  });

  describe('text widget', () => {
    it('does not include the description in the builder params', () => {
      const widget = {
        title: 'Text Widget',
        displayType: DisplayType.TEXT,
        interval: '',
        queries: [],
        description: 'Test Description',
      };
      const params = convertWidgetToQueryParams(widget);
      expect(params.description).toBeUndefined();
      expect(params.title).toBe('Text Widget');
      expect(params.displayType).toBe(DisplayType.TEXT);
      expect(params.field).toEqual([]);
      expect(params.sort).toEqual([]);
    });
  });
});

describe('convertWidgetToBuilderState', () => {
  it('includes textContent from description for text widgets', () => {
    const widget = {
      title: 'Text Widget',
      displayType: DisplayType.TEXT,
      interval: '',
      queries: [],
      description: 'My text content',
    };
    const params = convertWidgetToBuilderState(widget);
    expect(params.textContent as string).toBe('My text content');
    expect(params.description).toBeUndefined();
  });

  it('does not include textContent for non-text widgets', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
      displayType: DisplayType.TABLE,
      description: 'Widget description',
    };
    const params = convertWidgetToBuilderState(widget);
    expect(params.textContent).toBeUndefined();
    expect(params.description).toBe('Widget description');
  });
});
