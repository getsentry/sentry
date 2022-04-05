import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import GroupSidebar from 'sentry/components/group/sidebar';
import {CommittersProvider} from 'sentry/stores/commiters/committersProvider';

describe('GroupSidebar', function () {
  const {organization, project, routerContext} = initializeOrg();
  const environment = {name: 'production', displayName: 'Production', id: '1'};

  beforeEach(function () {
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
      url: '/groups/1/integrations/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/issues/1/participants/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/issues/1/',
      body: TestStubs.Group({tags: TestStubs.Tags()}),
    });

    MockApiClient.addMockResponse({
      url: '/issues/1/current-release/',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/groups/1/external-issues/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/codeowners/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/prompts-activity/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      query: {project: -1},
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('sidebar', function () {
    it('should make a request to the /tags/ endpoint to get top values', function () {
      const tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: TestStubs.Tags(),
      });

      mountWithTheme(
        <CommittersProvider>
          <GroupSidebar
            group={TestStubs.Group({tags: TestStubs.Tags()})}
            project={project}
            organization={organization}
            event={TestStubs.Event()}
            environments={[environment]}
          />
        </CommittersProvider>,
        routerContext
      );

      expect(tagsMock).toHaveBeenCalled();
    });
  });

  describe('renders with tags', function () {
    it('renders', async function () {
      MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: [],
      });

      const wrapper = mountWithTheme(
        <CommittersProvider>
          <GroupSidebar
            group={TestStubs.Group({tags: TestStubs.Tags()})}
            project={project}
            organization={organization}
            event={TestStubs.Event()}
            environments={[environment]}
          />
        </CommittersProvider>,
        routerContext
      );

      expect(wrapper.find('SuggestedOwners')).toHaveLength(1);
      expect(wrapper.find('Memo(GroupReleaseStats)')).toHaveLength(1);
      expect(wrapper.find('ExternalIssueList')).toHaveLength(1);
      await tick();
      wrapper.update();
      expect(wrapper.find('GroupTagDistributionMeter')).toHaveLength(5);
    });
  });

  describe('renders without tags', function () {
    it('renders no tags', async function () {
      const group = TestStubs.Group();

      MockApiClient.addMockResponse({
        url: '/issues/1/',
        body: group,
      });
      MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: [],
      });

      const wrapper = mountWithTheme(
        <CommittersProvider>
          <GroupSidebar
            api={new MockApiClient()}
            group={group}
            organization={organization}
            project={project}
            event={TestStubs.Event()}
            environments={[environment]}
          />
        </CommittersProvider>,
        routerContext
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('GroupTagDistributionMeter')).toHaveLength(0);
      expect(wrapper.find('[data-test-id="no-tags"]').text()).toBe(
        'No tags found in the selected environments'
      );
    });
  });

  describe('environment toggle', function () {
    it('re-requests tags with correct environment', async function () {
      const tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: TestStubs.Tags(),
      });

      const wrapper = mountWithTheme(
        <GroupSidebar
          api={new MockApiClient()}
          group={TestStubs.Group()}
          organization={organization}
          project={project}
          event={TestStubs.Event()}
          environments={[environment]}
        />,
        {routerContext, Providers: CommittersProvider}
      );

      const stagingEnv = {name: 'staging', displayName: 'Staging', id: '2'};
      expect(tagsMock).toHaveBeenCalledTimes(1);

      wrapper.setProps({environments: [stagingEnv]});

      expect(tagsMock).toHaveBeenCalledTimes(2);
      expect(tagsMock).toHaveBeenCalledWith(
        '/issues/1/tags/',
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['staging'],
          }),
        })
      );
    });
  });
});
