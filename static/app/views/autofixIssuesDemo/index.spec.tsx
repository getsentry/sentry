import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AutofixIssuesDemo from 'sentry/views/autofixIssuesDemo';

describe('AutofixIssuesDemo', () => {
  const organization = OrganizationFixture();
  const pathname = `/organizations/${organization.slug}/issues/autofix/issues/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
  });

  it('requests the default query when the URL query is empty', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });

    render(<AutofixIssuesDemo />, {
      organization,
      initialRouterConfig: {location: {pathname, query: {query: ''}}},
    });

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'is:unresolved has:issue.seer_last_run',
          }),
        })
      )
    );
  });

  it('pushes the query without the cursor when searching', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });
    const {router} = render(<AutofixIssuesDemo />, {
      organization,
      initialRouterConfig: {
        location: {pathname, query: {query: 'is:unresolved', cursor: '0:25:0'}},
      },
    });
    await screen.findByText('No autofix issues found for this organization.');

    await userEvent.type(
      screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)!,
      'is:resolved{enter}'
    );
    await waitFor(() =>
      expect(router.location.query).toEqual({query: 'is:unresolved is:resolved'})
    );
    expect(router.historyAction).toBe('PUSH');
  });
});
