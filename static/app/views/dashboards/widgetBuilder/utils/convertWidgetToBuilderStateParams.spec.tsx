import {DisplayType} from 'sentry/views/dashboards/types';
import {
  convertWidgetToBuilderStateParams,
  DEFAULT_WIDGET,
} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';

describe('convertWidgetToBuilderStateParams', () => {
  it('should not pass along yAxis when converting a table to builder params', () => {
    const widget = {
      ...DEFAULT_WIDGET,
      displayType: DisplayType.TABLE,
      queries: [
        {
          ...DEFAULT_WIDGET.queries[0],
          aggregates: ['count()'],
        },
      ],
    };
    const params = convertWidgetToBuilderStateParams(widget);
    expect(params.yAxis).toEqual([]);
  });
});
