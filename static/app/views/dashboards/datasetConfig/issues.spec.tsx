import {GlobalSelectionFixture} from 'sentry-fixture/globalSelection';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {GroupStatus} from 'sentry/types/group';
import {
  transformIssuesResponseToSeries,
  transformIssuesResponseToTable,
} from 'sentry/views/dashboards/datasetConfig/issues';

describe('transformIssuesResponseToTable', () => {
  it('transforms issues response', () => {
    expect(
      transformIssuesResponseToTable(
        [
          GroupFixture({
            id: '1',
            title: 'Error: Failed',
            project: ProjectFixture({
              id: '3',
            }),
            status: GroupStatus.UNRESOLVED,
            owners: [
              {
                type: 'ownershipRule',
                owner: 'user:2',
                date_added: '2022-01-01T13:04:02Z',
              },
            ],
            lifetime: {count: '10', firstSeen: '', lastSeen: '', stats: {}, userCount: 5},
            count: '6',
            userCount: 3,
            firstSeen: '2022-01-01T13:04:02Z',
          }),
        ],
        {
          name: '',
          fields: ['issue', 'assignee', 'title', 'culprit', 'status'],
          columns: ['issue', 'assignee', 'title', 'culprit', 'status'],
          aggregates: [],
          conditions: 'assigned_or_suggested:#visibility timesSeen:>100',
          orderby: '',
        },
        OrganizationFixture(),
        GlobalSelectionFixture()
      )
    ).toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            discoverSearchQuery: ' assigned_or_suggested:#visibility timesSeen:>100',
            events: '6',
            firstSeen: '2022-01-01T13:04:02Z',
            id: '1',
            'issue.id': '1',
            lifetimeUsers: 5,
            links: [],
            period: '',
            projectId: '3',
            status: 'unresolved',
            title: 'Error: Failed',
            users: 3,
            end: '2019-09-09T11:18:59',
            start: '2019-10-09T11:18:59',
          }),
        ],
        meta: {
          fields: expect.objectContaining({
            assignee: 'string',
            events: 'string',
            firstSeen: 'date',
            isBookmarked: 'boolean',
            isHandled: 'boolean',
            isSubscribed: 'boolean',
            issue: 'string',
            lastSeen: 'date',
            level: 'string',
            lifetimeEvents: 'string',
            lifetimeUsers: 'string',
            links: 'string',
            platform: 'string',
            project: 'string',
            status: 'string',
            title: 'string',
            users: 'string',
          }),
        },
      })
    );
  });
  it('transforms issues timeseries response to series', () => {
    expect(
      transformIssuesResponseToSeries({
        timeSeries: [
          {
            yAxis: 'count(new_issues)',
            values: [{timestamp: 1763495560000, value: 10}],
            meta: {
              valueType: 'integer',
              valueUnit: null,
              interval: 10800000,
            },
          },
        ],
      })
    ).toEqual([expect.objectContaining({data: [{name: 1763495560000, value: 10}]})]);
  });
});
