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

  function mockInboxCount(count?: number) {
    return MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
      headers: count === undefined ? {} : {'X-Hits': String(count)},
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
    const request = mockInboxCount(12);

    renderNavigation();

    expect(await screen.findByText('12')).toBeInTheDocument();

    const [[, options]] = request.mock.calls;
    const {query} = options.query;
    expect(query).toContain('fix_proposed');
    expect(query).toContain('diagnosed');
    expect(query).toContain('assigned');
    expect(query).toContain('assigned:[me,my_teams]');
    expect(options.query).toEqual(
      expect.objectContaining({
        collapse: ['stats', 'unhandled'],
        limit: 1,
        project: [-1],
        sort: 'progress',
      })
    );
  });

  it('caps the count at 99+', async () => {
    mockInboxCount(100);

    renderNavigation();

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });

  it('renders no badge when nothing is waiting', async () => {
    mockInboxCount(0);

    renderNavigation();

    expect(await screen.findByRole('link', {name: 'Inbox'})).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders no badge when the response has no count header', async () => {
    mockInboxCount();

    renderNavigation();

    expect(await screen.findByRole('link', {name: 'Inbox'})).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
