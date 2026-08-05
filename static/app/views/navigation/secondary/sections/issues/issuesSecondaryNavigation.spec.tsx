import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {INBOX_AUTOFIX_CATEGORY_FILTER} from 'sentry/views/issueList/queries/inbox';
import {IssuesSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/issues/issuesSecondaryNavigation';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

describe('IssuesSecondaryNavigation', () => {
  const inboxCountQuery = `is:unresolved issue.progress:[fix_proposed,diagnosed,assigned] assigned:[me,my_teams]${INBOX_AUTOFIX_CATEGORY_FILTER}`;
  const organization = OrganizationFixture({
    features: ['issue-stream-progress-ui', 'gen-ai-features', 'seat-based-seer-enabled'],
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/starred/',
      body: [],
    });
  });

  function mockInboxCount(body: Record<string, number>) {
    return MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      body,
    });
  }

  function renderNavigation(testOrganization = organization) {
    render(
      <SecondaryNavigationContextProvider>
        <IssuesSecondaryNavigation />
      </SecondaryNavigationContextProvider>,
      {organization: testOrganization}
    );
  }

  it('shows the inbox count for Seer progress sections and the user and their teams', async () => {
    const request = mockInboxCount({
      [inboxCountQuery]: 12,
    });

    renderNavigation();

    expect(await screen.findByText('12')).toBeInTheDocument();

    // One query, since a separate Snuba search runs per `query` param.
    const [[, options]] = request.mock.calls;
    expect(options.query.query).toHaveLength(1);
    const [query] = options.query.query;
    expect(query).toContain('fix_proposed');
    expect(query).toContain('diagnosed');
    expect(query).toContain('assigned');
    expect(query).toContain('is:unresolved');
    expect(query).toContain('assigned:[me,my_teams]');
  });

  it('caps the count at 99+ since the endpoint stops counting at 100', async () => {
    mockInboxCount({
      [inboxCountQuery]: 100,
    });

    renderNavigation();

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });

  it('renders no badge when nothing is waiting', async () => {
    mockInboxCount({
      [inboxCountQuery]: 0,
    });

    renderNavigation();

    expect(
      await screen.findByRole('link', {name: 'Inbox experimental'})
    ).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('does not render Inbox or request its count without Autofix access', async () => {
    const request = mockInboxCount({});
    const organizationWithoutAutofix = OrganizationFixture({
      features: ['issue-stream-progress-ui', 'gen-ai-features'],
    });

    renderNavigation(organizationWithoutAutofix);

    expect(await screen.findByRole('link', {name: 'Feed'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /Inbox/})).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
