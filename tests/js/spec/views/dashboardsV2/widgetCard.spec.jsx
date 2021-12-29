import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import * as modal from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {WidgetType} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';

function openContextMenu(card) {
  card.find('DropdownMenu MoreOptions svg').simulate('click');
}

function clickMenuItem(card, selector) {
  card
    .find(`DropdownMenu MenuItem[data-test-id="${selector}"] MenuTarget`)
    .simulate('click');
}

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
    widgetType: WidgetType.DISCOVER,
    queries: [
      {
        conditions: 'event.type:error',
        fields: ['count()', 'failure_count()'],
        name: 'errors',
      },
      {
        conditions: 'event.type:default',
        fields: ['count()', 'failure_count()'],
        name: 'default',
      },
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
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
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

  it('renders with Open in Discover button and opens in Discover when clicked', async function () {
    const wrapper = mountWithTheme(
      <WidgetCard
        api={api}
        organization={initialData.organization}
        widget={{...multipleQueryWidget, queries: [multipleQueryWidget.queries[0]]}}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      >
        {() => <div data-test-id="child" />}
      </WidgetCard>,
      initialData.routerContext
    );

    await tick();

    const menuOptions = wrapper.find('ContextMenu').props().children;
    expect(menuOptions.length > 0).toBe(true);
    expect(menuOptions[0].props.children.props.children).toContain(t('Open in Discover'));
    expect(menuOptions[0].props.to).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/discover/results/',
        query: expect.objectContaining({
          field: ['count()', 'failure_count()'],
          name: 'Errors',
          query: 'event.type:error',
          yAxis: ['count()', 'failure_count()'],
        }),
      })
    );
  });

  it('Opens in Discover with World Map', async function () {
    const wrapper = mountWithTheme(
      <WidgetCard
        api={api}
        organization={initialData.organization}
        widget={{
          ...multipleQueryWidget,
          displayType: 'world_map',
          queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      >
        {() => <div data-test-id="child" />}
      </WidgetCard>,
      initialData.routerContext
    );

    await tick();

    const menuOptions = wrapper.find('ContextMenu').props().children;
    expect(menuOptions.length > 0).toBe(true);
    expect(menuOptions[0].props.children.props.children).toContain(t('Open in Discover'));
    expect(menuOptions[0].props.to).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/discover/results/',
        query: expect.objectContaining({
          display: 'worldmap',
          field: ['geo.country_code', 'count()'],
          name: 'Errors',
          query: 'event.type:error has:geo.country_code',
          yAxis: ['count()'],
        }),
      })
    );
  });

  it('calls onDuplicate when Duplicate Widget is clicked', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <WidgetCard
        api={api}
        organization={initialData.organization}
        widget={{
          ...multipleQueryWidget,
          displayType: 'world_map',
          queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={mock}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      >
        {() => <div data-test-id="child" />}
      </WidgetCard>,
      initialData.routerContext
    );

    await tick();

    openContextMenu(wrapper);
    wrapper.update();
    clickMenuItem(wrapper, 'duplicate-widget');
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('does not add duplicate widgets if max widget is reached', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <WidgetCard
        api={api}
        organization={initialData.organization}
        widget={{
          ...multipleQueryWidget,
          displayType: 'world_map',
          queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={mock}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached
      >
        {() => <div data-test-id="child" />}
      </WidgetCard>,
      initialData.routerContext
    );

    await tick();

    openContextMenu(wrapper);
    wrapper.update();
    clickMenuItem(wrapper, 'duplicate-widget');
    expect(mock).toHaveBeenCalledTimes(0);
  });
});
