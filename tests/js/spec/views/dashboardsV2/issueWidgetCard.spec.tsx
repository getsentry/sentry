import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import IssueWidgetCard from 'sentry/views/dashboardsV2/issueWidgetCard';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';

describe('Dashboards > IssueWidgetCard', function () {
  const initialData = initializeOrg();

  const widget: Widget = {
    title: 'Issues',
    interval: '5m',
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.ISSUE,
    queries: [
      {
        conditions: 'event.type:default',
        fields: [],
        name: '',
        orderby: '',
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
            type: 'team',
            id: '2222222',
            name: 'discoveranddashboards',
          },
        },
      ],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders with title and issues chart', async function () {
    const wrapper = mountWithTheme(
      <IssueWidgetCard
        api={api}
        organization={initialData.organization}
        widget={widget}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
      />
    );

    await tick();

    expect(wrapper.getByText('Issues')).toBeInTheDocument();
    expect(wrapper.getByText('assignee')).toBeInTheDocument();
    expect(wrapper.getByText('title')).toBeInTheDocument();
    expect(wrapper.getByText('issue #')).toBeInTheDocument();
    expect(wrapper.getByText('discoveranddashboards')).toBeInTheDocument();
    expect(wrapper.getByText('ISSUE')).toBeInTheDocument();
    expect(
      wrapper.getByText('ChunkLoadError: Loading chunk app_bootstrap_index_tsx failed.')
    ).toBeInTheDocument();
  });

  it('opens in issues page', async function () {
    mountWithTheme(
      <IssueWidgetCard
        api={api}
        organization={initialData.organization}
        widget={widget}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
      />
    );

    await tick();

    userEvent.click(screen.getByTestId('context-menu'));
    expect(screen.getByText('Open in Issues').closest('a')?.href).toContain(
      '/organizations/org-slug/issues/?query=event.type%3Adefault&statsPeriod=14d'
    );
  });
});
