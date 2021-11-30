import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import SortableWidget from 'sentry/views/dashboardsV2/sortableWidget';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';

describe('Dashboards > SortableWidget', () => {
  const organization = TestStubs.Organization({
    features: ['dashboards-basic', 'dashboards-edit'],
  });
  const widget = {
    title: 'Test Query',
    displayType: DisplayType.LINE,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '',
        fields: ['count()'],
        orderby: '',
      },
    ],
  };

  let initialData;

  beforeEach(() => {
    initialData = initializeOrg({organization, router: {}, project: 1, projects: []});
  });
  it('renders a discover WidgetCard', async () => {
    const wrapper = mountWithTheme(
      <SortableWidget
        widget={widget}
        dragId=""
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
      />,
      initialData.routerContext
    );
    expect(wrapper.find('IssueWidgetCard').length).toBe(0);
    expect(wrapper.find('WidgetCard').length).toBe(1);
  });
  it('renders an IssueWidgetCard', async () => {
    const wrapper = mountWithTheme(
      <SortableWidget
        widget={{...widget, widgetType: WidgetType.ISSUE}}
        dragId=""
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
      />,
      initialData.routerContext
    );
    expect(wrapper.find('IssueWidgetCard').length).toBe(1);
    expect(wrapper.find('WidgetCard').length).toBe(0);
  });
});
