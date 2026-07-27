import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssuesSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/issues/issuesSecondaryNavigation';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

describe('IssuesSecondaryNavigation', () => {
  const organization = OrganizationFixture({
    features: ['issue-stream-progress-ui'],
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

  function renderNavigation() {
    render(
      <SecondaryNavigationContextProvider>
        <IssuesSecondaryNavigation />
      </SecondaryNavigationContextProvider>,
      {organization}
    );
  }

  it('shows the inbox count for every progress section and the user and their teams', async () => {
    const request = mockInboxCount({
      'issue.progress:[fix_proposed, diagnosed, assigned] assigned:[me,my_teams]': 12,
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
    expect(query).toContain('assigned:[me,my_teams]');
  });

  it('caps the count at 99+ since the endpoint stops counting at 100', async () => {
    mockInboxCount({
      'issue.progress:[fix_proposed, diagnosed, assigned] assigned:[me,my_teams]': 100,
    });

    renderNavigation();

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });

  it('renders no badge when nothing is waiting', async () => {
    mockInboxCount({
      'issue.progress:[fix_proposed, diagnosed, assigned] assigned:[me,my_teams]': 0,
    });

    renderNavigation();

    expect(await screen.findByRole('link', {name: 'Inbox'})).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
