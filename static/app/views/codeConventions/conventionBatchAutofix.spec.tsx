import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConventionBatchAutofix} from 'sentry/views/codeConventions/conventionBatchAutofix';

describe('ConventionBatchAutofix', () => {
  it("starts full Autofix runs on the convention's next issues without a run", async () => {
    const issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [GroupFixture({id: '1'}), GroupFixture({id: '2'})],
    });
    const startRequests = ['1', '2'].map(id =>
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${id}/autofix/`,
        method: 'POST',
        body: {run_id: Number(id)},
      })
    );

    render(<ConventionBatchAutofix conventionName="no-class-components" />);
    await userEvent.click(screen.getByRole('button', {name: 'Autofix next 5'}));

    await waitFor(() => expect(startRequests[1]).toHaveBeenCalled());
    expect(issuesRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'is:unresolved title:"*[no-class-components]*" !has:issue.seer_last_run',
          limit: 5,
        }),
      })
    );
    for (const request of startRequests) {
      expect(request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: {step: 'root_cause', stopping_point: 'open_pr', referrer: 'api.web'},
        })
      );
    }
  });

  it('starts nothing when every issue already has a run', async () => {
    const issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });

    render(<ConventionBatchAutofix conventionName="no-class-components" />);
    await userEvent.click(screen.getByRole('button', {name: 'Autofix next 5'}));

    await waitFor(() => expect(issuesRequest).toHaveBeenCalled());
    expect(screen.getByRole('button', {name: 'Autofix next 5'})).toBeEnabled();
  });
});
