import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {MemberListStore} from 'sentry/stores/memberListStore';

import {GroupSidebar} from './groupSidebar';

describe('GroupSidebar', () => {
  let group = GroupFixture();
  const {organization, project} = initializeOrg();
  const environment = 'production';
  let tagsMock: jest.Mock;

  beforeEach(() => {
    MemberListStore.loadInitialData([]);
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/committers/',
      body: {committers: []},
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/owners/',
      body: {
        owners: [],
        rules: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/integrations/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/`,
      body: group,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/external-issues/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/codeowners/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/?project=-1`,
      method: 'GET',
      body: [],
    });
    tagsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/1/tags/`,
      body: TagsFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('sidebar', () => {
    it('should make a request to the /tags/ endpoint to get top values', async () => {
      render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={EventFixture()}
          environments={[environment]}
        />
      );

      expect(await screen.findByText('browser')).toBeInTheDocument();
      expect(tagsMock).toHaveBeenCalled();
    });
  });

  describe('renders with tags', () => {
    it('renders', async () => {
      render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={EventFixture()}
          environments={[environment]}
        />
      );
      expect(await screen.findByText('browser')).toBeInTheDocument();
      expect(screen.getByText('device')).toBeInTheDocument();
      expect(screen.getByText('url')).toBeInTheDocument();
      expect(screen.getByText('environment')).toBeInTheDocument();
      expect(screen.getByText('user')).toBeInTheDocument();
    });
  });

  describe('environment toggle', () => {
    it('re-requests tags with correct environment', async () => {
      const stagingEnv = 'staging';
      const {rerender} = render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={EventFixture()}
          environments={[environment]}
        />
      );
      expect(await screen.findByText('browser')).toBeInTheDocument();
      expect(tagsMock).toHaveBeenCalledTimes(1);
      rerender(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={EventFixture()}
          environments={[stagingEnv]}
        />
      );
      expect(await screen.findByText('browser')).toBeInTheDocument();
      expect(tagsMock).toHaveBeenCalledTimes(2);
      expect(tagsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/1/tags/',
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['staging'],
          }),
        })
      );
    });
  });

  describe('renders without tags', () => {
    beforeEach(() => {
      group = GroupFixture();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/',
        body: group,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/tags/',
        body: [],
      });
    });

    it('renders empty text', async () => {
      render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={EventFixture()}
          environments={[environment]}
        />
      );
      expect(
        await screen.findByText('No tags found in the selected environments')
      ).toBeInTheDocument();
    });
  });

  describe('displays mobile tags when issue platform is mobile', () => {
    beforeEach(() => {
      group = GroupFixture();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/',
        body: group,
      });
    });

    it('renders mobile tags on top of tag summary for mobile platforms', async () => {
      render(
        <GroupSidebar
          group={group}
          project={{...project, platform: 'react-native'}}
          organization={organization}
          event={EventFixture()}
          environments={[environment]}
        />
      );
      await waitFor(() => expect(tagsMock).toHaveBeenCalled());
      expect(
        within(await screen.findByTestId('top-distribution-wrapper')).getByText('device')
      ).toBeInTheDocument();
    });

    it('does not render mobile tags on top of tag summary for non mobile platforms', async () => {
      render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={EventFixture()}
          environments={[environment]}
        />
      );
      await waitFor(() => expect(tagsMock).toHaveBeenCalled());
      expect(
        within(await screen.findByTestId('top-distribution-wrapper')).queryByText(
          'device'
        )
      ).not.toBeInTheDocument();
    });
  });
});
