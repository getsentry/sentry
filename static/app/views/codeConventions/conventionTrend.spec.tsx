import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConventionTrend} from 'sentry/views/codeConventions/conventionTrend';

describe('ConventionTrend', () => {
  it('requests daily distinct violations for the convention', async () => {
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[1759449600, [{count: 45}]]]},
    });

    render(<ConventionTrend titlePrefix="[no-class-components]" />);

    await waitFor(() =>
      expect(statsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'errors',
            interval: '1d',
            project: '4511567035432960',
            query: 'title:"*[no-class-components]*"',
            yAxis: 'count_unique(issue)',
          }),
        })
      )
    );
  });
});
