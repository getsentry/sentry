import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {WidgetBuilderState} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToStateQueryParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToStateQueryParams';
import {FieldValueKind} from 'sentry/views/discover/table/types';

describe('convertBuilderStateToStateQueryParams', function () {
  it('returns the query params with the provided widget queries state', function () {
    const mockState: WidgetBuilderState = {
      title: 'Test Widget',
      description: 'Test Description',
      dataset: WidgetType.ERRORS,
      displayType: DisplayType.LINE,
      limit: 5,
      fields: [{kind: 'field', field: 'geo.country'}],
      yAxis: [{kind: 'function', function: ['count', '', undefined, undefined]}],
      sort: [{field: 'geo.country', kind: 'desc'}],
    };

    const queryParams = convertBuilderStateToStateQueryParams(mockState);

    expect(queryParams).toEqual({
      title: 'Test Widget',
      description: 'Test Description',
      dataset: WidgetType.ERRORS,
      displayType: DisplayType.LINE,
      limit: 5,
      field: ['geo.country'],
      yAxis: ['count()'],
      sort: ['-geo.country'],
      thresholds: undefined,
    });
  });

  it('adds aliases to the query params', function () {
    const mockState: WidgetBuilderState = {
      fields: [
        {field: 'geo.country', alias: 'test', kind: FieldValueKind.FIELD},
        {field: 'geo.country', alias: undefined, kind: FieldValueKind.FIELD},
        {field: 'geo.country', alias: 'another one', kind: FieldValueKind.FIELD},
      ],
      legendAlias: ['test', '', 'another one'],
    };
    const queryParams = convertBuilderStateToStateQueryParams(mockState);

    expect(queryParams.legendAlias).toEqual(['test', '', 'another one']);
  });

  it('propagates the selected aggregate to the query params', () => {
    const mockState: WidgetBuilderState = {
      selectedAggregate: 0,
      query: ['transaction.duration:>100'],
    };

    const queryParams = convertBuilderStateToStateQueryParams(mockState);

    expect(queryParams.selectedAggregate).toBe(0);
  });

  it('applies the thresholds to the query params', () => {
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

    const queryParams = convertBuilderStateToStateQueryParams(mockState);

    expect(queryParams.thresholds).toEqual(JSON.stringify(mockState.thresholds));
  });
});
