import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {IssueCategory} from 'sentry/types/group';
import {IssuePreviewDrawer} from 'sentry/views/issueDetails/issuePreview/issuePreviewDrawer';

const organization = OrganizationFixture({id: '4660', slug: 'org'});

const project = ProjectFixture({
  id: '2448',
  name: 'project name',
  slug: 'project',
  teams: [TeamFixture({id: '3', slug: 'frontend', name: 'Frontend'})],
});

const group = GroupFixture({
  id: '1337',
  issueCategory: IssueCategory.ERROR,
  project,
});

describe('IssuePreviewDrawer', () => {
  beforeEach(() => {
    ConfigStore.init();
    ConfigStore.set('user', UserFixture());
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        billing: null,
        integration: {ok: false, reason: null},
        seerReposLinked: false,
        githubWriteIntegration: null,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('resolves the issue', async () => {
    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: {...group, status: 'resolved'},
    });

    render(<IssuePreviewDrawer groupId={group.id} />, {organization});

    const resolveButton = await screen.findByRole('button', {name: 'Resolve'});

    // The drawer refetches the group after the update; return the resolved group.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: {...group, status: 'resolved'},
    });

    await userEvent.click(resolveButton);

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/issues/`,
        expect.objectContaining({
          data: {status: 'resolved', statusDetails: {}, substatus: null},
        })
      );
    });

    expect(await screen.findAllByText('Resolved')).not.toHaveLength(0);
  });
});
