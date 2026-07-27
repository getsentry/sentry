import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useInboxIssueCount} from 'sentry/views/issueList/queries/useInboxIssueCount';

const INBOX_QUERY =
  'issue.progress:[fix_proposed, diagnosed, assigned] assigned:[me,my_teams]';

describe('useInboxIssueCount', () => {
  const organization = OrganizationFixture();

  it('counts every section in a single query', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      body: {[INBOX_QUERY]: 12},
    });

    const {result} = renderHookWithProviders(useInboxIssueCount, {organization});

    await waitFor(() => expect(result.current).toBe(12));

    // One query, not one per section — the endpoint runs a separate Snuba search
    // for every query param it receives.
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/issues-count/',
      expect.objectContaining({
        query: expect.objectContaining({query: [INBOX_QUERY], project: [-1]}),
      })
    );
  });

  it('returns null while loading so the badge stays hidden', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      body: {},
      asyncDelay: 100,
    });

    const {result} = renderHookWithProviders(useInboxIssueCount, {organization});

    expect(result.current).toBeNull();
  });
});
