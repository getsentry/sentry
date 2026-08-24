import {
  ExplorerAutofixBlockFixture,
  ExplorerAutofixResponseFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {IssuePreview} from './issuePreview';

describe('IssuePreview', () => {
  const organization = OrganizationFixture({features: ['gen-ai-features']});
  const project = ProjectFixture({id: '1'});
  const group = GroupFixture({id: '101', project, hasSeen: true});

  beforeEach(() => {
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      body: {},
    });
  });

  it('links to an open user pull request and shows the next Autofix step', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '10',
              externalUrl: 'https://github.com/example/repo-name/pull/10',
            }),
            attribution: null,
            checksStatus: null,
            dateLinked: '2026-07-20T12:00:00Z',
            reviewStatus: null,
            status: 'open',
          },
        ],
      },
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(
      await screen.findByRole('button', {name: 'View example/repo-name#10'})
    ).toHaveAttribute('href', 'https://github.com/example/repo-name/pull/10');
    expect(screen.getByRole('button', {name: 'Find Root Cause'})).toBeInTheDocument();
  });

  it('offers to restart Autofix after PR creation when the linked PR is closed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          blocks: [
            ExplorerAutofixBlockFixture(),
            ExplorerAutofixBlockFixture({
              id: 'solution',
              message: {
                content: 'Plan complete',
                metadata: {step: 'solution'},
                role: 'assistant',
              },
            }),
            ExplorerAutofixBlockFixture({
              id: 'code-changes',
              message: {
                content: 'Code changes complete',
                metadata: {step: 'code_changes'},
                role: 'assistant',
              },
            }),
            ExplorerAutofixBlockFixture({
              id: 'completed',
              message: {
                content: 'Autofix complete',
                metadata: {step: 'completed'},
                role: 'assistant',
              },
            }),
          ],
        }),
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '10',
              externalUrl: 'https://github.com/example/repo-name/pull/10',
            }),
            attribution: {id: 'seer', type: 'seer'},
            checksStatus: null,
            dateLinked: '2026-07-20T12:00:00Z',
            reviewStatus: null,
            status: 'closed',
          },
        ],
      },
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(
      await screen.findByRole('button', {name: 'Restart Autofix'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'View example/repo-name#10'})
    ).not.toBeInTheDocument();
  });
});
