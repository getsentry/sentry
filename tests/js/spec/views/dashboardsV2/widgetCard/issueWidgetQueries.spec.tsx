import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import IssueWidgetQueries from 'sentry/views/dashboardsV2/widgetCard/issueWidgetQueries';

describe('IssueWidgetQueries', function () {
  it('does an issue query and passes correct transformedResults to child component', async function () {
    const {organization} = initializeOrg({
      router: {orgId: 'orgId'},
    } as Parameters<typeof initializeOrg>[0]);
    const api = new MockApiClient();
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
        transformedResults: [
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
      })
    );
  });
});
