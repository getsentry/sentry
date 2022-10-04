import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupSidebar from 'sentry/components/group/sidebar';

describe('GroupSidebar', function () {
  let group = TestStubs.Group({tags: TestStubs.Tags()});
  const {organization, project} = initializeOrg();
  const environment = {name: 'production', displayName: 'Production', id: '1'};
  let tagsMock;

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
      body: group,
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
    tagsMock = MockApiClient.addMockResponse({
      url: '/issues/1/tags/',
      body: TestStubs.Tags(),
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('sidebar', () => {
    it('should make a request to the /tags/ endpoint to get top values', async () => {
      render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={TestStubs.Event()}
          environments={[environment]}
        />,
        {organization}
      );

      expect(await screen.findByText('browser')).toBeInTheDocument();
      expect(tagsMock).toHaveBeenCalled();
    });
  });

  describe('renders with tags', function () {
    it('renders', async function () {
      render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={TestStubs.Event()}
          environments={[environment]}
        />,
        {organization}
      );
      expect(await screen.findByText('browser')).toBeInTheDocument();
      expect(await screen.getByText('device')).toBeInTheDocument();
      expect(await screen.getByText('url')).toBeInTheDocument();
      expect(await screen.getByText('environment')).toBeInTheDocument();
      expect(await screen.getByText('user')).toBeInTheDocument();
    });
  });

  describe('environment toggle', function () {
    it('re-requests tags with correct environment', async function () {
      const stagingEnv = {name: 'staging', displayName: 'Staging', id: '2'};
      const {rerender} = render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={TestStubs.Event()}
          environments={[environment]}
        />,
        {organization}
      );
      expect(await screen.findByText('browser')).toBeInTheDocument();
      expect(tagsMock).toHaveBeenCalledTimes(1);
      rerender(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={TestStubs.Event()}
          environments={[stagingEnv]}
        />,
        {organization}
      );
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

  describe('renders without tags', function () {
    beforeEach(function () {
      group = TestStubs.Group();

      MockApiClient.addMockResponse({
        url: '/issues/1/',
        body: group,
      });
      MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: [],
      });
    });

    it('renders empty text', async function () {
      render(
        <GroupSidebar
          group={group}
          project={project}
          organization={organization}
          event={TestStubs.Event()}
          environments={[environment]}
        />,
        {organization}
      );
      expect(
        await screen.findByText('No tags found in the selected environments')
      ).toBeInTheDocument();
    });
  });
});
