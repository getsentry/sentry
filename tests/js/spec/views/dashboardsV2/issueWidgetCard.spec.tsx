import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import MemberListStore from 'sentry/stores/memberListStore';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('Dashboards > IssueWidgetCard', function () {
  const {router, organization, routerContext} = initializeOrg({
    organization: TestStubs.Organization({
      features: ['dashboards-edit'],
    }),
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);

  const widget: Widget = {
    title: 'Issues',
    interval: '5m',
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.ISSUE,
    queries: [
      {
        conditions: 'event.type:default',
        fields: ['issue', 'assignee', 'title'],
        name: '',
        orderby: IssueSortOptions.FREQ,
      },
    ],
  };
  const selection = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: false,
    },
  };

  const api = new Client();

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [
        {
          id: '44444444',
          title: 'ChunkLoadError: Loading chunk app_bootstrap_index_tsx failed.',
          shortId: 'ISSUE',
          assignedTo: {
            type: 'user',
            id: '2222222',
            name: 'dashboard user',
            email: 'dashboarduser@sentry.io',
          },
          lifetime: {count: 10, userCount: 5},
          count: 6,
          userCount: 3,
          project: {id: 1},
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders with title and issues chart', async function () {
    MemberListStore.loadInitialData([]);
    mountWithTheme(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
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
      />
    );

    expect(await screen.findByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('assignee')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('issue')).toBeInTheDocument();
    expect(screen.getByText('DU')).toBeInTheDocument();
    expect(screen.getByText('ISSUE')).toBeInTheDocument();
    expect(
      screen.getByText('ChunkLoadError: Loading chunk app_bootstrap_index_tsx failed.')
    ).toBeInTheDocument();
    userEvent.hover(screen.getByTitle('dashboard user'));
    expect(await screen.findByText('Assigned to')).toBeInTheDocument();
    expect(await screen.findByText('dashboard user')).toBeInTheDocument();
  });

  it('opens in issues page', async function () {
    mountWithTheme(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
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
      />,
      {context: routerContext}
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();

    expect(screen.getByText('Open in Issues')).toBeInTheDocument();
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Open in Issues'}));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/?query=event.type%3Adefault&sort=freq&statsPeriod=14d'
    );
  });

  it('calls onDuplicate when Duplicate Widget is clicked', async function () {
    const mock = jest.fn();
    mountWithTheme(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
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
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
    userEvent.click(screen.getByText('Duplicate Widget'));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('disables the duplicate widget button if max widgets is reached', async function () {
    const mock = jest.fn();
    mountWithTheme(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
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
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
    userEvent.click(screen.getByText('Duplicate Widget'));
    expect(mock).toHaveBeenCalledTimes(0);
  });

  it('maps lifetimeEvents and lifetimeUsers headers to more human readable', async function () {
    MemberListStore.loadInitialData([]);
    mountWithTheme(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...widget,
          queries: [
            {
              ...widget.queries[0],
              fields: ['issue', 'assignee', 'title', 'lifetimeEvents', 'lifetimeUsers'],
            },
          ],
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
      />
    );

    expect(await screen.findByText('Lifetime Events')).toBeInTheDocument();
    expect(screen.getByText('Lifetime Users')).toBeInTheDocument();
  });
});
