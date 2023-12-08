import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  DashboardFilterKeys,
  DisplayType,
  Widget,
  WidgetType,
} from 'sentry/views/dashboards/types';
import IssueWidgetQueries from 'sentry/views/dashboards/widgetCard/issueWidgetQueries';

describe('IssueWidgetQueries', function () {
  const widget: Widget = {
    id: '1',
    title: 'Issues Widget',
    displayType: DisplayType.TABLE,
    interval: '5m',
    queries: [
      {
        name: '',
        fields: ['issue', 'assignee', 'title', 'culprit', 'status'],
        columns: ['issue', 'assignee', 'title', 'culprit', 'status'],
        aggregates: [],
        conditions: 'assigned_or_suggested:#visibility timesSeen:>100',
        orderby: '',
      },
    ],
    widgetType: WidgetType.ISSUE,
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

  const {organization} = initializeOrg({
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);
  const api = new MockApiClient();

  it('does an issue query and passes correct tableResults to child component', async function () {
    const mockFunction = jest.fn(() => {
      return <div />;
    });

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'GET',
      body: [
        {
          id: '1',
          title: 'Error: Failed',
          project: {
            id: '3',
          },
          status: 'unresolved',
          owners: [
            {
              type: 'ownershipRule',
              owner: 'user:2',
            },
          ],
          lifetime: {count: 10, userCount: 5},
          count: 6,
          userCount: 3,
          firstSeen: '2022-01-01T13:04:02Z',
        },
      ],
    });

    render(
      <IssueWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={{
          projects: [1],
          environments: ['prod'],
          datetime: {
            period: '14d',
            start: null,
            end: null,
            utc: false,
          },
        }}
      >
        {mockFunction}
      </IssueWidgetQueries>
    );

    await tick();
    expect(mockFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        tableResults: [
          expect.objectContaining({
            data: [
              expect.objectContaining({
                id: '1',
                title: 'Error: Failed',
                status: 'unresolved',
                lifetimeEvents: 10,
                lifetimeUsers: 5,
                events: 6,
                users: 3,
                firstSeen: '2022-01-01T13:04:02Z',
              }),
            ],
          }),
        ],
      })
    );
  });

  it('appends dashboard filters to issue request', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });
    render(
      <IssueWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        dashboardFilters={{[DashboardFilterKeys.RELEASE]: ['abc@1.2.0', 'abc@1.3.0']}}
      >
        {() => <div data-test-id="child" />}
      </IssueWidgetQueries>
    );

    await screen.findByTestId('child');
    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        data: expect.objectContaining({
          query:
            'assigned_or_suggested:#visibility timesSeen:>100 release:["abc@1.2.0","abc@1.3.0"] ',
        }),
      })
    );
  });
});
