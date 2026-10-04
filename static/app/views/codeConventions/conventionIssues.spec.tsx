import {GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventOrGroupType} from 'sentry/types/event';
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
    for (const hidden of ['Last Seen', 'Events', 'Users', 'Priority', 'Graph:']) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }

    expect(issuesRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: '4511567035432960',
          query: 'is:unresolved title:"*[no-class-components]*"',
        }),
      })
    );
    expect(screen.getByRole('link', {name: 'Issues'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Code Quality'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'getsentry/sentry'})).toBeInTheDocument();
  });
});
