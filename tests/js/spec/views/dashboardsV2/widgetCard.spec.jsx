import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import * as modal from 'app/actionCreators/modal';
import {Client} from 'app/api';
import {t} from 'app/locale';
import WidgetCard from 'app/views/dashboardsV2/widgetCard';

describe('Dashboards > WidgetCard', function () {
  const initialData = initializeOrg({
    organization: TestStubs.Organization({
      features: ['connect-discover-and-dashboards', 'dashboards-edit', 'discover-basic'],
      projects: [TestStubs.Project()],
    }),
  });

  const multipleQueryWidget = {
    title: 'Errors',
    interval: '5m',
    displayType: 'line',
    queries: [
      {conditions: 'event.type:error', fields: ['count()'], name: 'errors'},
      {conditions: 'event.type:default', fields: ['count()'], name: 'default'},
    ],
  };
  const selection = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
    },
  };

  const api = new Client();

  const mockEvent = {
    preventDefault: () => undefined,
  };

  beforeEach(function () {
    browserHistory.push.mockReset();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-geo/',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders with Open in Discover button and opens the Query Selector Modal when clicked', async function () {
    const spy = jest.spyOn(modal, 'openDashboardWidgetQuerySelectorModal');
    const wrapper = mountWithTheme(
      <WidgetCard
        api={api}
        organization={initialData.organization}
        widget={multipleQueryWidget}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
      >
        {() => <div data-test-id="child" />}
      </WidgetCard>,
      initialData.routerContext
    );

    await tick();

    const menuOptions = wrapper.find('ContextMenu').props().children;
    expect(menuOptions.length > 0).toBe(true);
    expect(menuOptions[0].props.children).toEqual(t('Open in Discover'));
    menuOptions[0].props.onClick(mockEvent);
    expect(spy).toHaveBeenCalledWith({
      organization: initialData.organization,
      widget: multipleQueryWidget,
    });
  });
});
