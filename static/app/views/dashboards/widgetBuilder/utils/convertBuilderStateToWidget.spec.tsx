import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {WidgetBuilderState} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {FieldValueKind} from 'sentry/views/discover/table/types';

describe('convertBuilderStateToWidget', function () {
  it('returns the widget with the provided widget queries state', function () {
    const mockState: WidgetBuilderState = {
      title: 'Test Widget',
      description: 'Test Description',
      dataset: WidgetType.ERRORS,
      displayType: DisplayType.LINE,
      limit: 5,
      fields: [{kind: 'field', field: 'geo.country'}],
      yAxis: [{kind: 'function', function: ['count', '', undefined, undefined]}],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget).toEqual({
      title: 'Test Widget',
      description: 'Test Description',
      widgetType: WidgetType.ERRORS,
      displayType: DisplayType.LINE,
      interval: '1h',
      limit: 5,
      queries: [
        {
          fields: ['geo.country', 'count()'],
          fieldAliases: [''],
          aggregates: ['count()'],
          columns: ['geo.country'],
          conditions: '',
          name: '',
          orderby: 'geo.country',
          selectedAggregate: undefined,
        },
      ],
      thresholds: undefined,
    });
  });

  it('injects the orderby from the sort state into the widget queries', function () {
    const mockState: WidgetBuilderState = {
      query: ['transaction.duration:>100', 'transaction.duration:>50'],
      sort: [{field: 'geo.country', kind: 'desc'}],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.orderby).toBe('-geo.country');
    expect(widget.queries[1]!.orderby).toBe('-geo.country');
  });

  it('does not convert aggregates to aliased format', function () {
    const mockState: WidgetBuilderState = {
      query: ['transaction.duration:>100', 'transaction.duration:>50'],
      sort: [{field: 'count()', kind: 'desc'}],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.orderby).toBe('-count()');
    expect(widget.queries[1]!.orderby).toBe('-count()');
  });

  it('adds aliases to the widget queries', function () {
    const mockState: WidgetBuilderState = {
      fields: [
        {field: 'geo.country', alias: 'test', kind: FieldValueKind.FIELD},
        {field: 'geo.country', alias: undefined, kind: FieldValueKind.FIELD},
        {field: 'geo.country', alias: 'another one', kind: FieldValueKind.FIELD},
      ],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.fieldAliases).toEqual(['test', '', 'another one']);
  });

  it('adds legend aliases to the widget queries', function () {
    const mockState: WidgetBuilderState = {
      legendAlias: ['test', 'test2'],
      query: ['transaction.duration:>100', 'transaction.duration:>50'],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.name).toBe('test');
    expect(widget.queries[0]!.conditions).toBe('transaction.duration:>100');
    expect(widget.queries[1]!.name).toBe('test2');
    expect(widget.queries[1]!.conditions).toBe('transaction.duration:>50');
  });

  it('propagates the selected aggregate to the widget query', () => {
    const mockState: WidgetBuilderState = {
      selectedAggregate: 0,
      query: ['transaction.duration:>100'],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.selectedAggregate).toBe(0);
  });

  it('sets selectedAggregate to undefined if not provided', () => {
    const mockState: WidgetBuilderState = {
      query: ['transaction.duration:>100'],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.selectedAggregate).toBeUndefined();
  });

  it('applies the thresholds to the widget', () => {
    const mockState: WidgetBuilderState = {
      query: ['transaction.duration:>100'],
      thresholds: {
        max_values: {
          max1: 200,
          max2: 300,
        },
        unit: 'milliseconds',
      },
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.thresholds).toEqual(mockState.thresholds);
  });

  it('uses the fields from widget state when displaying as a table', function () {
    const mockState: WidgetBuilderState = {
      fields: [
        {field: 'geo.country', kind: FieldValueKind.FIELD},
        {
          function: ['count', '', undefined, undefined],
          kind: FieldValueKind.FUNCTION,
        },
      ],
      displayType: DisplayType.TABLE,
      dataset: WidgetType.TRANSACTIONS,
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.fields).toEqual(['geo.country', 'count()']);
  });

  it('combines columns and aggregates into fields when producing the widget when not displayed as a table', function () {
    const mockState: WidgetBuilderState = {
      fields: [{field: 'geo.country', kind: FieldValueKind.FIELD}],
      yAxis: [
        {
          function: ['count', '', undefined, undefined],
          kind: FieldValueKind.FUNCTION,
        },
      ],
      displayType: DisplayType.LINE,
      dataset: WidgetType.TRANSACTIONS,
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.fields).toEqual(['geo.country', 'count()']);
  });

  it('ignores empty fields', function () {
    const mockState: WidgetBuilderState = {
      fields: [{field: '', kind: FieldValueKind.FIELD}],
      yAxis: [
        {function: ['count', '', undefined, undefined], kind: FieldValueKind.FUNCTION},
      ],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.fields).toEqual(['count()']);
    expect(widget.queries[0]!.aggregates).toEqual(['count()']);
    expect(widget.queries[0]!.columns).toEqual([]);
  });

  it('ignores the sort state when producing a big number widget', function () {
    const mockState: WidgetBuilderState = {
      displayType: DisplayType.BIG_NUMBER,
      fields: [
        {function: ['count', '', undefined, undefined], kind: FieldValueKind.FUNCTION},
      ],
      dataset: WidgetType.TRANSACTIONS,
      query: ['transaction.duration:>100'],
      sort: [{field: 'count()', kind: 'desc'}],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0]!.orderby).toBe('');
  });
});
