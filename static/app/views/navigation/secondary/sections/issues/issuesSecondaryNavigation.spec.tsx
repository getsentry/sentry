import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {INBOX_AUTOFIX_CATEGORY_FILTER} from 'sentry/views/issueList/pages/inbox/utils';
import {IssuesSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/issues/issuesSecondaryNavigation';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import type {LLMContextNodeSnapshot} from 'sentry/views/seerExplorer/contexts/llmContextTypes';

describe('IssuesSecondaryNavigation', () => {
  const inboxCountQuery = `is:unresolved issue.progress:[fix_proposed,diagnosed,assigned,identified] assigned_or_suggested:me${INBOX_AUTOFIX_CATEGORY_FILTER}`;
  const organization = OrganizationFixture({
    features: ['issue-inbox', 'gen-ai-features', 'seat-based-seer-enabled'],
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

  it('shows the inbox count for Seer progress sections assigned or suggested to the user', async () => {
    const request = mockInboxCount({
      [inboxCountQuery]: 12,
    });

    renderNavigation();

    expect(await screen.findByText('12')).toBeInTheDocument();

    // One query, since a separate Snuba search runs per `query` param.
    const [[, options]] = request.mock.calls;
    expect(options.query.query).toHaveLength(1);
    const [query] = options.query.query;
    expect(options.query).not.toHaveProperty('project');
    expect(query).toContain('fix_proposed');
    expect(query).toContain('diagnosed');
    expect(query).toContain('assigned');
    expect(query).toContain('identified');
    expect(query).toContain('is:unresolved');
    expect(query).toContain('assigned_or_suggested:me');
  });

  it('caps the count at 99+ since the endpoint stops counting at 100', async () => {
    mockInboxCount({
      [inboxCountQuery]: 100,
    });

    renderNavigation();

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });

  it('does not render Inbox or request its count without Autofix access', async () => {
    const request = mockInboxCount({});
    const organizationWithoutAutofix = OrganizationFixture({
      features: ['issue-inbox', 'gen-ai-features'],
    });

    renderNavigation(organizationWithoutAutofix);

    expect(await screen.findByRole('link', {name: 'Feed'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /Inbox/})).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('renders the Autofix Overview link when the org has seer-night-shift-ui', async () => {
    mockInboxCount({});
    const organizationWithOverview = OrganizationFixture({
      features: [
        'issue-inbox',
        'gen-ai-features',
        'seat-based-seer-enabled',
        'seer-night-shift-ui',
      ],
    });

    renderNavigation(organizationWithOverview);

    const overviewLink = await screen.findByRole('link', {name: /Overview/});
    expect(overviewLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/autofix/'
    );
  });

  it('does not render the Autofix Overview link without seer-night-shift-ui', async () => {
    mockInboxCount({});

    renderNavigation();

    expect(await screen.findByRole('link', {name: 'Feed'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /Overview/})).not.toBeInTheDocument();
  });

  describe('LLM context', () => {
    // Captures the (stable) `getLLMContext` function, not a snapshot result —
    // this component renders once, before any other component's registration
    // effects have fired, so the data must be read fresh on each check
    // inside `waitFor`, not frozen at this component's own render time.
    function makeContextCapture() {
      const ref: {current: (() => LLMContextNodeSnapshot[]) | null} = {current: null};

      function ContextCapture() {
        const {getLLMContext} = useLLMContext();
        ref.current = () => getLLMContext().nodes;
        return null;
      }

      return {
        ContextCapture,
        getNodes: () => {
          if (!ref.current) {
            throw new Error('ContextCapture not mounted');
          }
          return ref.current();
        },
      };
    }

    it('publishes issue types and the starred views list as nested navigation nodes', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/starred/',
        body: [
          GroupSearchViewFixture({
            id: '1',
            name: 'My Team Backlog',
            query: 'is:unresolved',
          }),
        ],
      });
      mockInboxCount({});

      const {ContextCapture, getNodes} = makeContextCapture();

      render(
        <SecondaryNavigationContextProvider>
          <IssuesSecondaryNavigation />
          <ContextCapture />
        </SecondaryNavigationContextProvider>,
        {organization}
      );

      await waitFor(() => {
        const issuesNode = getNodes().find(node => node.nodeType === 'navigation');
        expect(issuesNode).toBeDefined();
        const data = issuesNode!.data as Record<string, unknown>;
        expect(data.issueTypes).toEqual(
          expect.arrayContaining([expect.objectContaining({key: 'errors-outages'})])
        );

        // The "issues" node also has an InboxCountBadge child in this fixture
        // (Autofix access is on), so pick the starred-views child by shape
        // rather than assuming it's the only — or the first — sibling.
        const starredViewsNode = issuesNode!.children.find(
          child =>
            child.nodeType === 'navigation' &&
            'views' in (child.data as Record<PropertyKey, unknown>)
        );
        expect(starredViewsNode).toBeDefined();
        const starredViewsData = starredViewsNode!.data as {views: unknown[]};
        expect(starredViewsData.views).toEqual([
          expect.objectContaining({
            id: '1',
            label: 'My Team Backlog',
            query: 'is:unresolved',
          }),
        ]);
      });
    });
  });
});
