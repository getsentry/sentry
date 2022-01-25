import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import MemberListStore from 'sentry/stores/memberListStore';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('Dashboards > IssueWidgetCard', function () {
  const initialData = initializeOrg({
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
        organization={initialData.organization}
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

    await tick();

    expect(screen.getByText('Issues')).toBeInTheDocument();
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
        organization={initialData.organization}
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

    await tick();

    userEvent.click(screen.getByTestId('context-menu'));
    expect(screen.getByText('Open in Issues').closest('a')?.href).toContain(
      '/organizations/org-slug/issues/?query=event.type%3Adefault&sort=freq&statsPeriod=14d'
    );
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
  });

  it('calls onDuplicate when Duplicate Widget is clicked', async function () {
    const mock = jest.fn();
    mountWithTheme(
      <WidgetCard
        api={api}
        organization={initialData.organization}
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

    await tick();

    userEvent.click(screen.getByTestId('context-menu'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
    userEvent.click(screen.getByText('Duplicate Widget'));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('disables the duplicate widget button if max widgets is reached', async function () {
    const mock = jest.fn();
    mountWithTheme(
      <WidgetCard
        api={api}
        organization={initialData.organization}
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

    await tick();

    userEvent.click(screen.getByTestId('context-menu'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
    userEvent.click(screen.getByText('Duplicate Widget'));
    expect(mock).toHaveBeenCalledTimes(0);
  });
});
