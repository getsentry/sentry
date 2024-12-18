import {WidgetType} from 'sentry/views/dashboards/types';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getDefaultWidget} from 'sentry/views/dashboards/widgetBuilder/utils/getDefaultWidget';

describe('convertWidgetToBuilderStateParams', () => {
  it('should not pass along yAxis when converting a table to builder params', () => {
    const widget = {...getDefaultWidget(WidgetType.ERRORS), aggregates: ['count()']};
    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.yAxis).toEqual([]);
  });
});
