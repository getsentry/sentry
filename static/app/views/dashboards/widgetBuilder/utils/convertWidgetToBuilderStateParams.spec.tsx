import {WidgetType} from 'sentry/views/dashboards/types';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getDefaultWidget} from 'sentry/views/dashboards/widgetBuilder/utils/getDefaultWidget';

describe('convertWidgetToBuilderStateParams', () => {
  it('should not pass along yAxis when converting a table to builder params', () => {
    const widget = {...getDefaultWidget(WidgetType.ERRORS), aggregates: ['count()']};
    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.yAxis).toEqual([]);
  });

  it('stringifies the fields when converting a table to builder params', () => {
    const widget = {
      ...getDefaultWidget(WidgetType.ERRORS),
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
});
