import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {WidgetBuilderState} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

describe('convertBuilderStateToWidget', function () {
  it('returns the default of the dataset config when no widget queries state is provided', function () {
    const mockState: WidgetBuilderState = {
      title: 'Test Widget',
      description: 'Test Description',
      dataset: WidgetType.ERRORS,
      displayType: DisplayType.TABLE,
      limit: 5,
      fields: [],
      yAxis: [],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget).toEqual({
      title: 'Test Widget',
      description: 'Test Description',
      widgetType: WidgetType.ERRORS,
      displayType: DisplayType.TABLE,
      interval: '1h',
      limit: 5,
      queries: [
        {
          ...getDatasetConfig(WidgetType.ERRORS).defaultWidgetQuery,
        },
      ],
    });
  });

  it('returns the default of the dataset config when no widget queries state is provided - issues', function () {
    const mockState: WidgetBuilderState = {
      title: 'Test Issues Widget',
      description: 'test description for an issues widget',
      dataset: WidgetType.ISSUE,
      displayType: DisplayType.TABLE,
      limit: 5,
      fields: [],
      yAxis: [],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget).toEqual({
      title: 'Test Issues Widget',
      description: 'test description for an issues widget',
      widgetType: WidgetType.ISSUE,
      displayType: DisplayType.TABLE,
      interval: '1h',
      limit: 5,
      queries: [
        {
          ...getDatasetConfig(WidgetType.ISSUE).defaultWidgetQuery,
        },
      ],
    });
  });

  it('returns the widget with the provided widget queries state', function () {
    const mockState: WidgetBuilderState = {
      title: 'Test Widget',
      description: 'Test Description',
      dataset: WidgetType.ERRORS,
      displayType: DisplayType.TABLE,
      limit: 5,
      fields: [
        {kind: 'field', field: 'geo.country'},
        {
          function: ['count', '', undefined, undefined],
          kind: 'function',
        },
        {
          function: ['count_unique', 'user', undefined, undefined],
          kind: 'function',
        },
      ],
      yAxis: [{kind: 'field', field: 'count()'}],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget).toEqual({
      title: 'Test Widget',
      description: 'Test Description',
      widgetType: WidgetType.ERRORS,
      displayType: DisplayType.TABLE,
      interval: '1h',
      limit: 5,
      queries: [
        {
          fields: ['geo.country', 'count()', 'count_unique(user)'],
          fieldAliases: [],
          aggregates: ['count()'],
          columns: ['geo.country'],
          conditions: '',
          name: '',
          orderby: 'geo.country',
        },
      ],
    });
  });

  it('injects the orderby from the sort state into the widget queries', function () {
    const mockState: WidgetBuilderState = {
      query: ['transaction.duration:>100', 'transaction.duration:>50'],
      sort: [{field: 'geo.country', kind: 'desc'}],
    };

    const widget = convertBuilderStateToWidget(mockState);

    expect(widget.queries[0].orderby).toEqual('-geo.country');
    expect(widget.queries[1].orderby).toEqual('-geo.country');
  });
});
