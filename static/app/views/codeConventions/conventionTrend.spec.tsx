import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  bucketResolutions,
  ConventionTrend,
} from 'sentry/views/codeConventions/conventionTrend';

const NOW = Date.parse('2026-10-03T12:00:00Z');

describe('bucketResolutions', () => {
  it('counts resolutions per day and drops ones outside the window', () => {
    const buckets = bucketResolutions(
      {
        resolvedAt: [
          '2026-10-03T01:00:00Z',
          '2026-10-03T23:00:00Z',
          '2026-10-01T10:00:00Z',
          '2026-08-01T10:00:00Z',
        ],
        sampled: 4,
        total: 4,
      },
      NOW,
      3
    );

    expect(buckets).toEqual([
      {name: Date.parse('2026-10-01T00:00:00Z'), value: 1},
      {name: Date.parse('2026-10-02T00:00:00Z'), value: 0},
      {name: Date.parse('2026-10-03T00:00:00Z'), value: 2},
    ]);
  });

  it('scales a sample up to the total', () => {
    const buckets = bucketResolutions(
      {resolvedAt: ['2026-10-03T01:00:00Z'], sampled: 25, total: 100},
      NOW,
      1
    );

    expect(buckets).toEqual([{name: Date.parse('2026-10-03T00:00:00Z'), value: 4}]);
  });
});

describe('ConventionTrend', () => {
  it("reads resolution times from each resolved issue's activity", async () => {
    const issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [{id: '1'}, {id: '2'}],
      headers: {'X-Hits': '2'},
    });
    const activityRequests = ['1', '2'].map(id =>
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${id}/activities/`,
        body: {
          activity: [
            {type: 'set_resolved', dateCreated: new Date().toISOString()},
            {type: 'set_unresolved', dateCreated: '2026-01-01T00:00:00Z'},
          ],
        },
      })
    );

    render(<ConventionTrend titlePrefix="[no-class-components]" />);

    await waitFor(() => expect(activityRequests[1]).toHaveBeenCalled());
    expect(activityRequests[0]).toHaveBeenCalled();
    expect(issuesRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: '4511567035432960',
          query: 'is:resolved title:"*[no-class-components]*"',
          statsPeriod: '30d',
        }),
      })
    );
  });
});
