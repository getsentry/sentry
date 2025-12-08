import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Widget} from 'sentry/views/dashboards/types';
import {
  DashboardFilterKeys,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import IssueWidgetQueries from 'sentry/views/dashboards/widgetCard/issueWidgetQueries';

describe('IssueWidgetQueries', () => {
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

  const organization = OrganizationFixture();
  const api = new MockApiClient();
  describe('table display type', () => {
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

    it('does an issue query and passes correct tableResults to child component', async () => {
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

      await waitFor(() =>
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
        )
      );
    });

    it('appends dashboard filters to issue request', async () => {
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
  describe('series display type', () => {
    const widget: Widget = {
      id: '1',
      title: 'Issues Widget',
      displayType: DisplayType.BAR,
      interval: '5m',
      queries: [
        {
          name: '',
          fields: ['count(new_issues)'],
          columns: [],
          aggregates: ['count(new_issues)'],
          conditions: '',
          orderby: '-count(new_issues)',
        },
      ],
      widgetType: WidgetType.ISSUE,
    };

    let issuesTimeseriesMock: jest.Mock;

    beforeEach(() => {
      issuesTimeseriesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues-timeseries/',
        body: {
          timeSeries: [
            {
              yAxis: 'count(new_issues)',
              values: [{timestamp: '1763495560000', value: 10}],
            },
          ],
          meta: {
            interval: 10800000,
            valueType: 'integer',
            valueUnit: null,
          },
        },
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('does an issues-timeseries query and passes results to child component', async () => {
      const mockFunction = jest.fn(() => {
        return <div />;
      });
      render(
        <IssueWidgetQueries
          api={api}
          organization={organization}
          widget={widget}
          selection={selection}
        >
          {mockFunction}
        </IssueWidgetQueries>
      );

      expect(issuesTimeseriesMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            category: 'issue',
            yAxis: ['count(new_issues)'],
          }),
        })
      );
      await waitFor(() =>
        expect(mockFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            timeseriesResults: [
              expect.objectContaining({
                data: [{name: '1763495560000', value: 10}],
                seriesName: 'count(new_issues)',
              }),
            ],
          })
        )
      );
    });
  });
});
