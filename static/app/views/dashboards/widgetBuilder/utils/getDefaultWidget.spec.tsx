import {SessionField} from 'sentry/types/sessions';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {getDefaultWidget} from 'sentry/views/dashboards/widgetBuilder/utils/getDefaultWidget';

describe('getDefaultWidget', () => {
  it('should return a default widget for errors', () => {
    const widget = getDefaultWidget(WidgetType.ERRORS);
    expect(widget).toEqual({
      displayType: DisplayType.LINE,
      interval: '',
      title: 'Custom Widget',
      widgetType: WidgetType.ERRORS,
      queries: [
        {
          fields: ['count_unique(user)'],
          conditions: '',
          aggregates: ['count_unique(user)'],
          columns: [],
          orderby: '-count_unique(user)',
          fieldAliases: [],
          name: '',
        },
      ],
    });
  });

  it('should return a default widget for spans', () => {
    const widget = getDefaultWidget(WidgetType.SPANS);
    expect(widget).toEqual({
      displayType: DisplayType.LINE,
      interval: '',
      title: 'Custom Widget',
      widgetType: WidgetType.SPANS,
      queries: [
        {
          fields: ['count(span.duration)'],
          conditions: '',
          aggregates: ['count(span.duration)'],
          columns: [],
          orderby: '-count(span.duration)',
          fieldAliases: [],
          name: '',
        },
      ],
    });
  });

  it('should return a default widget for issues', () => {
    const widget = getDefaultWidget(WidgetType.ISSUE);
    expect(widget).toEqual({
      displayType: DisplayType.TABLE,
      interval: '',
      title: 'Custom Widget',
      widgetType: WidgetType.ISSUE,
      queries: [
        {
          fields: ['issue', 'assignee', 'title'] as string[],
          columns: ['issue', 'assignee', 'title'],
          conditions: '',
          aggregates: [],
          orderby: 'date',
          fieldAliases: [],
          name: '',
        },
      ],
    });
  });

  it('should return a default widget for releases', () => {
    const widget = getDefaultWidget(WidgetType.RELEASE);
    expect(widget).toEqual({
      displayType: DisplayType.LINE,
      interval: '',
      title: 'Custom Widget',
      widgetType: WidgetType.RELEASE,
      queries: [
        {
          fields: [`crash_free_rate(${SessionField.SESSION})`],
          columns: [],
          fieldAliases: [],
          aggregates: [`crash_free_rate(${SessionField.SESSION})`],
          conditions: '',
          orderby: `-crash_free_rate(${SessionField.SESSION})`,
          name: '',
        },
      ],
    });
  });
});
