import fetchMock from 'jest-fetch-mock';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventOrGroupType} from 'sentry/types/event';
import {ProgressState} from 'sentry/types/group';
import ConventionIssues from 'sentry/views/codeConventions/conventionIssues';

describe('ConventionIssues', () => {
  it("lists the convention's issues with only the age and assignee columns", async () => {
    MockApiClient.addMockResponse({url: '/organizations/org-slug/users/', body: []});
    const issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [
        GroupFixture({
          id: '1',
          title: '## [no-class-components] static/app/profile.tsx:12',
          type: EventOrGroupType.DEFAULT,
          culprit: 'class Profile extends Component',
        }),
      ],
    });

    render(<ConventionIssues />, {
      initialRouterConfig: {
        location: {
          pathname:
            '/organizations/org-slug/issues/code-conventions/getsentry%2Fsentry/no-class-components/issues/',
        },
        route:
          '/organizations/:orgId/issues/code-conventions/:repoName/:conventionName/issues/',
      },
    });

    expect(
      await screen.findByText('## [no-class-components] static/app/profile.tsx:12')
    ).toBeInTheDocument();
    expect(screen.queryByText('class Profile extends Component')).not.toBeInTheDocument();

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Autofix')).toBeInTheDocument();
    for (const hidden of ['Last Seen', 'Events', 'Users', 'Priority', 'Graph:']) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }

    expect(issuesRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: '4511567035432960',
          query: 'is:unresolved title:"*[no-class-components]*"',
          expand: ['derivedData'],
        }),
      })
    );
    expect(screen.queryByRole('link', {name: 'Issues'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Code Quality'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'getsentry/sentry'})).toBeInTheDocument();
  });

  it('sorts issues by title from the Issue column heading', async () => {
    MockApiClient.addMockResponse({url: '/organizations/org-slug/users/', body: []});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [
        GroupFixture({
          id: '1',
          title: '## [no-class-components] static/b.tsx:12',
          type: EventOrGroupType.DEFAULT,
        }),
        GroupFixture({
          id: '2',
          title: '## [no-class-components] static/a.tsx:9',
          type: EventOrGroupType.DEFAULT,
        }),
        GroupFixture({
          id: '3',
          title: '## [no-class-components] static/a.tsx:10',
          type: EventOrGroupType.DEFAULT,
        }),
      ],
    });

    const {router} = render(<ConventionIssues />, {
      initialRouterConfig: {
        location: {
          pathname:
            '/organizations/org-slug/issues/code-conventions/getsentry%2Fsentry/no-class-components/issues/',
        },
        route:
          '/organizations/:orgId/issues/code-conventions/:repoName/:conventionName/issues/',
      },
    });

    const titles = () =>
      screen
        .getAllByText(/## \[no-class-components\]/)
        .map(element => element.textContent);

    await screen.findByText('## [no-class-components] static/b.tsx:12');

    await userEvent.click(screen.getByRole('button', {name: 'Issue'}));
    expect(router.location.query.sort).toBe('title');
    expect(titles()).toEqual([
      '## [no-class-components] static/a.tsx:9',
      '## [no-class-components] static/a.tsx:10',
      '## [no-class-components] static/b.tsx:12',
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'Issue'}));
    expect(router.location.query.sort).toBe('-title');
    expect(titles()[0]).toBe('## [no-class-components] static/b.tsx:12');
  });

  it('groups issues into the inbox progress sections', async () => {
    MockApiClient.addMockResponse({url: '/organizations/org-slug/users/', body: []});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [
        GroupFixture({
          id: '1',
          title: '## [no-class-components] static/a.tsx:1',
          type: EventOrGroupType.DEFAULT,
          seerAutofixLastTriggered: null,
        }),
        GroupFixture({
          id: '2',
          title: '## [no-class-components] static/b.tsx:1',
          type: EventOrGroupType.DEFAULT,
          derivedData: {
            hasOpenFixPr: true,
            hasRootCause: true,
            isAssigned: false,
            lastProgressedAt: null,
            progress: ProgressState.FIX_PROPOSED,
            status: 'open',
            viewCount: 0,
          },
        }),
      ],
    });

    render(<ConventionIssues />, {
      initialRouterConfig: {
        location: {
          pathname:
            '/organizations/org-slug/issues/code-conventions/getsentry%2Fsentry/no-class-components/issues/',
        },
        route:
          '/organizations/:orgId/issues/code-conventions/:repoName/:conventionName/issues/',
      },
    });

    const hasPr = await screen.findByRole('button', {name: /Fix Proposed/});
    const notStarted = screen.getByRole('button', {name: /Identified/});
    expect(
      hasPr.compareDocumentPosition(notStarted) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByRole('button', {name: /Diagnosed/})).not.toBeInTheDocument();
    expect(
      hasPr.compareDocumentPosition(
        screen.getByText('## [no-class-components] static/b.tsx:1')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('explains the convention in a collapsed disclosure', async () => {
    fetchMock.resetMocks();
    fetchMock.mockResponse(request =>
      Promise.resolve(
        request.url.includes('api.github.com')
          ? JSON.stringify([{name: 'no-class-components.yaml', sha: 'abc', type: 'file'}])
          : 'name: no-class-components\nwhy: |\n  Class components are the **legacy** style.\n'
      )
    );
    MockApiClient.addMockResponse({url: '/organizations/org-slug/users/', body: []});
    MockApiClient.addMockResponse({url: '/organizations/org-slug/issues/', body: []});

    render(<ConventionIssues />, {
      initialRouterConfig: {
        location: {
          pathname:
            '/organizations/org-slug/issues/code-conventions/getsentry%2Fsentry/no-class-components/issues/',
        },
        route:
          '/organizations/:orgId/issues/code-conventions/:repoName/:conventionName/issues/',
      },
    });

    const toggle = await screen.findByRole('button', {
      name: 'Why this convention matters',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(screen.getByText('legacy')).toBeVisible();
  });
});
