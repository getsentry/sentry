import {transformIssuesResponseToTable} from 'sentry/views/dashboardsV2/datasetConfig/issues';

describe('transformIssuesResponseToTable', function () {
  it('transforms issues response', () => {
    expect(
      transformIssuesResponseToTable(
        [
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
        {
          name: '',
          fields: ['issue', 'assignee', 'title', 'culprit', 'status'],
          columns: ['issue', 'assignee', 'title', 'culprit', 'status'],
          aggregates: [],
          conditions: 'assigned_or_suggested:#visibility timesSeen:>100',
          orderby: '',
        },
        TestStubs.Organization(),
        TestStubs.GlobalSelection()
      )
    ).toEqual({
      data: [
        {
          discoverSearchQuery: ' assigned_or_suggested:#visibility timesSeen:>100',
          events: 6,
          firstSeen: '2022-01-01T13:04:02Z',
          id: '1',
          issue: undefined,
          'issue.id': '1',
          lifetimeEvents: 10,
          lifetimeUsers: 5,
          links: undefined,
          period: '',
          project: undefined,
          projectId: '3',
          status: 'unresolved',
          title: 'Error: Failed',
          users: 3,
          end: '2019-09-09T11:18:59',
          start: '2019-10-09T11:18:59',
        },
      ],
    });
  });
});
